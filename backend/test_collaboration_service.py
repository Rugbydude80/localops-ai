"""
Tests for the collaboration service with WebSocket functionality and conflict resolution
"""
import pytest
import asyncio
import json
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import WebSocket, WebSocketDisconnect
from services.collaboration_service import (
    CollaborationManager, 
    UserPresence, 
    ScheduleEdit, 
    EditConflict,
    collaboration_manager
)

class MockWebSocket:
    """Mock WebSocket for testing"""
    def __init__(self):
        self.messages = []
        self.closed = False
        self.accept_called = False
    
    async def accept(self):
        self.accept_called = True
    
    async def send_text(self, message: str):
        if self.closed:
            raise WebSocketDisconnect(code=1000)
        self.messages.append(message)
    
    async def receive_text(self):
        # Mock implementation for testing
        return '{"type": "ping"}'
    
    def close(self):
        self.closed = True

@pytest.fixture
def collaboration_manager_instance():
    """Create a fresh collaboration manager for each test"""
    return CollaborationManager()

@pytest.fixture
def mock_websocket():
    """Create a mock WebSocket for testing"""
    return MockWebSocket()

class TestCollaborationManager:
    """Test suite for CollaborationManager"""
    
    @pytest.mark.asyncio
    async def test_connect_user(self, collaboration_manager_instance, mock_websocket):
        """Test user connection to collaboration system"""
        manager = collaboration_manager_instance
        
        connection_id = await manager.connect_user(
            mock_websocket, 1, "Test User", 123, "draft_123"
        )
        
        assert mock_websocket.accept_called
        assert connection_id in manager.connections
        assert manager.connections[connection_id] == mock_websocket
        assert (123, 1) in manager.connection_users.values()
        assert 123 in manager.user_presence
        assert 1 in manager.user_presence[123]
        
        presence = manager.user_presence[123][1]
        assert presence.user_name == "Test User"
        assert presence.business_id == 123
        assert presence.draft_id == "draft_123"
        assert presence.action == "viewing"
    
    @pytest.mark.asyncio
    async def test_disconnect_user(self, collaboration_manager_instance, mock_websocket):
        """Test user disconnection from collaboration system"""
        manager = collaboration_manager_instance
        
        # Connect user first
        connection_id = await manager.connect_user(
            mock_websocket, 1, "Test User", 123, "draft_123"
        )
        
        # Disconnect user
        await manager.disconnect_user(connection_id)
        
        assert connection_id not in manager.connections
        assert connection_id not in manager.connection_users
        assert 123 not in manager.user_presence or 1 not in manager.user_presence[123]
    
    @pytest.mark.asyncio
    async def test_update_user_presence(self, collaboration_manager_instance, mock_websocket):
        """Test updating user presence information"""
        manager = collaboration_manager_instance
        
        connection_id = await manager.connect_user(
            mock_websocket, 1, "Test User", 123, "draft_123"
        )
        
        await manager.update_user_presence(connection_id, "editing")
        
        presence = manager.user_presence[123][1]
        assert presence.action == "editing"
        assert presence.last_seen > datetime.now() - timedelta(seconds=1)
    
    @pytest.mark.asyncio
    async def test_acquire_edit_lock_success(self, collaboration_manager_instance, mock_websocket):
        """Test successful edit lock acquisition"""
        manager = collaboration_manager_instance
        
        connection_id = await manager.connect_user(
            mock_websocket, 1, "Test User", 123, "draft_123"
        )
        
        success = await manager.acquire_edit_lock(
            connection_id, "shift", 456, "draft_123"
        )
        
        assert success
        resource_key = "123:draft_123:shift:456"
        assert resource_key in manager.edit_locks
        assert manager.edit_locks[resource_key][0] == 1  # user_id
    
    @pytest.mark.asyncio
    async def test_acquire_edit_lock_conflict(self, collaboration_manager_instance):
        """Test edit lock conflict when resource is already locked"""
        manager = collaboration_manager_instance
        
        # Create two mock websockets and users
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()
        
        connection_id1 = await manager.connect_user(ws1, 1, "User 1", 123, "draft_123")
        connection_id2 = await manager.connect_user(ws2, 2, "User 2", 123, "draft_123")
        
        # User 1 acquires lock
        success1 = await manager.acquire_edit_lock(connection_id1, "shift", 456, "draft_123")
        assert success1
        
        # User 2 tries to acquire same lock
        success2 = await manager.acquire_edit_lock(connection_id2, "shift", 456, "draft_123")
        assert not success2
        
        # Check that User 2 received lock conflict message
        assert len(ws2.messages) > 0
        last_message = json.loads(ws2.messages[-1])
        assert last_message["type"] == "lock_conflict"
        assert last_message["locked_by_user_id"] == 1
    
    @pytest.mark.asyncio
    async def test_release_edit_lock(self, collaboration_manager_instance, mock_websocket):
        """Test releasing an edit lock"""
        manager = collaboration_manager_instance
        
        connection_id = await manager.connect_user(
            mock_websocket, 1, "Test User", 123, "draft_123"
        )
        
        # Acquire lock first
        await manager.acquire_edit_lock(connection_id, "shift", 456, "draft_123")
        resource_key = "123:draft_123:shift:456"
        assert resource_key in manager.edit_locks
        
        # Release lock
        await manager.release_edit_lock(connection_id, "shift", 456, "draft_123")
        assert resource_key not in manager.edit_locks
    
    @pytest.mark.asyncio
    async def test_record_edit_no_conflict(self, collaboration_manager_instance, mock_websocket):
        """Test recording an edit operation without conflicts"""
        manager = collaboration_manager_instance
        
        connection_id = await manager.connect_user(
            mock_websocket, 1, "Test User", 123, "draft_123"
        )
        
        conflict = await manager.record_edit(
            connection_id,
            "assign_staff",
            "assignment",
            789,
            {"staff_id": 1, "shift_id": 456},
            "draft_123"
        )
        
        assert conflict is None
        assert "draft_123" in manager.active_edits
        assert len(manager.active_edits["draft_123"]) == 1
        
        edit = manager.active_edits["draft_123"][0]
        assert edit.operation == "assign_staff"
        assert edit.target_type == "assignment"
        assert edit.target_id == 789
        assert edit.user_id == 1
    
    @pytest.mark.asyncio
    async def test_record_edit_with_conflict(self, collaboration_manager_instance):
        """Test recording an edit operation that creates a conflict"""
        manager = collaboration_manager_instance
        
        # Create two users
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()
        
        connection_id1 = await manager.connect_user(ws1, 1, "User 1", 123, "draft_123")
        connection_id2 = await manager.connect_user(ws2, 2, "User 2", 123, "draft_123")
        
        # First edit
        await manager.record_edit(
            connection_id1,
            "assign_staff",
            "assignment",
            789,
            {"staff_id": 1, "shift_id": 456},
            "draft_123"
        )
        
        # Second conflicting edit (same target)
        conflict = await manager.record_edit(
            connection_id2,
            "unassign_staff",
            "assignment",
            789,
            {"staff_id": 1, "shift_id": 456},
            "draft_123"
        )
        
        assert conflict is not None
        assert conflict.conflict_type == "concurrent_modification"
        assert conflict.edit1.user_id == 1
        assert conflict.edit2.user_id == 2
        assert conflict.conflict_id in manager.pending_conflicts
    
    @pytest.mark.asyncio
    async def test_resolve_conflict(self, collaboration_manager_instance):
        """Test resolving a pending conflict"""
        manager = collaboration_manager_instance
        
        # Create a mock conflict
        edit1 = ScheduleEdit(
            edit_id="edit1",
            user_id=1,
            user_name="User 1",
            timestamp=datetime.now(),
            operation="assign_staff",
            target_type="assignment",
            target_id=789,
            data={"staff_id": 1}
        )
        
        edit2 = ScheduleEdit(
            edit_id="edit2",
            user_id=2,
            user_name="User 2",
            timestamp=datetime.now(),
            operation="unassign_staff",
            target_type="assignment",
            target_id=789,
            data={"staff_id": 1}
        )
        
        conflict = EditConflict(
            conflict_id="conflict_123",
            edit1=edit1,
            edit2=edit2,
            conflict_type="concurrent_modification",
            resolution_strategy="last_write_wins"
        )
        
        manager.pending_conflicts[conflict.conflict_id] = conflict
        
        # Create a user connection for resolution
        ws = MockWebSocket()
        connection_id = await manager.connect_user(ws, 1, "User 1", 123, "draft_123")
        
        # Resolve conflict
        await manager.resolve_conflict(connection_id, conflict.conflict_id, "accept_edit1")
        
        assert conflict.conflict_id not in manager.pending_conflicts
        assert conflict.resolved
    
    @pytest.mark.asyncio
    async def test_get_active_users(self, collaboration_manager_instance):
        """Test getting active users for a business"""
        manager = collaboration_manager_instance
        
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()
        ws3 = MockWebSocket()
        
        # Connect users to same business but different drafts
        await manager.connect_user(ws1, 1, "User 1", 123, "draft_123")
        await manager.connect_user(ws2, 2, "User 2", 123, "draft_123")
        await manager.connect_user(ws3, 3, "User 3", 123, "draft_456")
        
        # Get users for specific draft
        users_draft_123 = await manager.get_active_users(123, "draft_123")
        assert len(users_draft_123) == 2
        
        # Get all users for business
        users_all = await manager.get_active_users(123)
        assert len(users_all) == 3
    
    @pytest.mark.asyncio
    async def test_broadcast_to_business(self, collaboration_manager_instance):
        """Test broadcasting messages to business users"""
        manager = collaboration_manager_instance
        
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()
        
        await manager.connect_user(ws1, 1, "User 1", 123, "draft_123")
        await manager.connect_user(ws2, 2, "User 2", 123, "draft_123")
        
        message = {"type": "test_message", "data": "hello"}
        
        await manager.broadcast_to_business(123, message, "draft_123")
        
        # Both users should receive the message
        assert len(ws1.messages) > 0
        assert len(ws2.messages) > 0
        
        received_message1 = json.loads(ws1.messages[-1])
        received_message2 = json.loads(ws2.messages[-1])
        
        assert received_message1["type"] == "test_message"
        assert received_message2["type"] == "test_message"
    
    @pytest.mark.asyncio
    async def test_cleanup_expired_locks(self, collaboration_manager_instance):
        """Test cleanup of expired edit locks"""
        manager = collaboration_manager_instance
        manager.lock_timeout = 0.1  # 0.1 seconds for testing
        
        # Add a lock
        resource_key = "123:draft_123:shift:456"
        manager.edit_locks[resource_key] = (1, datetime.now() - timedelta(seconds=1))
        
        # Cleanup should remove expired lock
        await manager._cleanup_expired_locks()
        
        assert resource_key not in manager.edit_locks
    
    @pytest.mark.asyncio
    async def test_concurrent_assignment_conflict_detection(self, collaboration_manager_instance):
        """Test detection of concurrent staff assignment conflicts"""
        manager = collaboration_manager_instance
        
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()
        
        connection_id1 = await manager.connect_user(ws1, 1, "User 1", 123, "draft_123")
        connection_id2 = await manager.connect_user(ws2, 2, "User 2", 123, "draft_123")
        
        # Both users try to assign the same staff member
        await manager.record_edit(
            connection_id1,
            "assign_staff",
            "assignment",
            789,
            {"staff_id": 5, "shift_id": 456},
            "draft_123"
        )
        
        conflict = await manager.record_edit(
            connection_id2,
            "assign_staff",
            "assignment",
            790,
            {"staff_id": 5, "shift_id": 457},  # Same staff, different shift
            "draft_123"
        )
        
        # Should detect concurrent assignment conflict
        assert conflict is not None
        assert conflict.conflict_type == "concurrent_assignment"

class TestWebSocketIntegration:
    """Test WebSocket integration with FastAPI"""
    
    @pytest.mark.asyncio
    async def test_websocket_connection_flow(self):
        """Test complete WebSocket connection and message flow"""
        from main import app
        from fastapi.testclient import TestClient
        
        # This would require a more complex setup with actual WebSocket testing
        # For now, we'll test the collaboration manager components
        pass

class TestConflictResolution:
    """Test conflict resolution strategies"""
    
    def test_conflict_type_determination(self):
        """Test different conflict type detection"""
        manager = CollaborationManager()
        
        # Same target, different operations
        edit1 = ScheduleEdit(
            edit_id="1", user_id=1, user_name="User 1", timestamp=datetime.now(),
            operation="assign_staff", target_type="assignment", target_id=123, data={}
        )
        edit2 = ScheduleEdit(
            edit_id="2", user_id=2, user_name="User 2", timestamp=datetime.now(),
            operation="unassign_staff", target_type="assignment", target_id=123, data={}
        )
        
        conflict_type = manager._determine_conflict_type(edit1, edit2)
        assert conflict_type == "concurrent_modification"
        
        # Same operation, same target
        edit3 = ScheduleEdit(
            edit_id="3", user_id=3, user_name="User 3", timestamp=datetime.now(),
            operation="assign_staff", target_type="assignment", target_id=123, data={}
        )
        
        conflict_type = manager._determine_conflict_type(edit1, edit3)
        assert conflict_type == "duplicate_operation"
    
    def test_concurrent_staff_assignment_detection(self):
        """Test detection of concurrent staff assignments"""
        manager = CollaborationManager()
        
        edit1 = ScheduleEdit(
            edit_id="1", user_id=1, user_name="User 1", timestamp=datetime.now(),
            operation="assign_staff", target_type="assignment", target_id=123, 
            data={"staff_id": 5, "shift_id": 456}
        )
        edit2 = ScheduleEdit(
            edit_id="2", user_id=2, user_name="User 2", timestamp=datetime.now(),
            operation="assign_staff", target_type="assignment", target_id=124,
            data={"staff_id": 5, "shift_id": 457}  # Same staff, different shift
        )
        
        conflict_type = manager._determine_conflict_type(edit1, edit2)
        assert conflict_type == "concurrent_assignment"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])