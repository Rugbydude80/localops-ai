"""
Real-time collaboration service for schedule editing with conflict resolution
"""
import json
import asyncio
from typing import Dict, List, Optional, Set, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import uuid
import logging

logger = logging.getLogger(__name__)

@dataclass
class UserPresence:
    """User presence information"""
    user_id: int
    user_name: str
    business_id: int
    draft_id: Optional[str]
    action: str  # 'viewing', 'editing', 'idle'
    last_seen: datetime
    websocket_id: str

@dataclass
class ScheduleEdit:
    """Represents a schedule edit operation"""
    edit_id: str
    user_id: int
    user_name: str
    timestamp: datetime
    operation: str  # 'assign_staff', 'unassign_staff', 'update_shift', 'create_shift', 'delete_shift'
    target_type: str  # 'shift', 'assignment'
    target_id: int
    data: Dict[str, Any]
    draft_id: Optional[str] = None

@dataclass
class EditConflict:
    """Represents a conflict between concurrent edits"""
    conflict_id: str
    edit1: ScheduleEdit
    edit2: ScheduleEdit
    conflict_type: str  # 'concurrent_assignment', 'shift_modification', 'resource_conflict'
    resolution_strategy: str  # 'last_write_wins', 'merge', 'manual_resolution'
    resolved: bool = False
    resolution_data: Optional[Dict[str, Any]] = None

class CollaborationManager:
    """Manages real-time collaboration for schedule editing"""
    
    def __init__(self):
        # WebSocket connections: {connection_id: WebSocket}
        self.connections: Dict[str, WebSocket] = {}
        
        # User presence: {business_id: {user_id: UserPresence}}
        self.user_presence: Dict[int, Dict[int, UserPresence]] = {}
        
        # Connection to user mapping: {connection_id: (business_id, user_id)}
        self.connection_users: Dict[str, tuple[int, int]] = {}
        
        # Active edits: {draft_id: List[ScheduleEdit]}
        self.active_edits: Dict[str, List[ScheduleEdit]] = {}
        
        # Pending conflicts: {conflict_id: EditConflict}
        self.pending_conflicts: Dict[str, EditConflict] = {}
        
        # Edit locks: {resource_key: (user_id, timestamp)}
        self.edit_locks: Dict[str, tuple[int, datetime]] = {}
        
        # Lock timeout in seconds
        self.lock_timeout = 30
    
    async def connect_user(
        self, 
        websocket: WebSocket, 
        user_id: int, 
        user_name: str,
        business_id: int, 
        draft_id: Optional[str] = None
    ) -> str:
        """Connect a user to the collaboration system"""
        await websocket.accept()
        
        connection_id = str(uuid.uuid4())
        self.connections[connection_id] = websocket
        self.connection_users[connection_id] = (business_id, user_id)
        
        # Update user presence
        if business_id not in self.user_presence:
            self.user_presence[business_id] = {}
        
        self.user_presence[business_id][user_id] = UserPresence(
            user_id=user_id,
            user_name=user_name,
            business_id=business_id,
            draft_id=draft_id,
            action='viewing',
            last_seen=datetime.now(),
            websocket_id=connection_id
        )
        
        # Notify other users about new presence
        await self._broadcast_presence_update(business_id, draft_id)
        
        # Send current presence to new user
        await self._send_current_presence(websocket, business_id, draft_id)
        
        logger.info(f"User {user_name} ({user_id}) connected to business {business_id}")
        return connection_id
    
    async def disconnect_user(self, connection_id: str):
        """Disconnect a user from the collaboration system"""
        if connection_id not in self.connection_users:
            return
        
        business_id, user_id = self.connection_users[connection_id]
        
        # Remove user presence
        if business_id in self.user_presence and user_id in self.user_presence[business_id]:
            user_presence = self.user_presence[business_id][user_id]
            draft_id = user_presence.draft_id
            
            # Release any locks held by this user
            await self._release_user_locks(user_id)
            
            del self.user_presence[business_id][user_id]
            
            # Clean up empty business presence
            if not self.user_presence[business_id]:
                del self.user_presence[business_id]
            
            # Notify other users about disconnection
            await self._broadcast_presence_update(business_id, draft_id)
        
        # Clean up connections
        if connection_id in self.connections:
            del self.connections[connection_id]
        del self.connection_users[connection_id]
        
        logger.info(f"User {user_id} disconnected from business {business_id}")
    
    async def update_user_presence(
        self, 
        connection_id: str, 
        action: str, 
        additional_data: Optional[Dict[str, Any]] = None
    ):
        """Update user presence information"""
        if connection_id not in self.connection_users:
            return
        
        business_id, user_id = self.connection_users[connection_id]
        
        if business_id in self.user_presence and user_id in self.user_presence[business_id]:
            presence = self.user_presence[business_id][user_id]
            presence.action = action
            presence.last_seen = datetime.now()
            
            # Broadcast presence update
            await self._broadcast_presence_update(business_id, presence.draft_id)
    
    async def acquire_edit_lock(
        self, 
        connection_id: str, 
        resource_type: str, 
        resource_id: int,
        draft_id: Optional[str] = None
    ) -> bool:
        """Acquire an edit lock for a resource"""
        if connection_id not in self.connection_users:
            return False
        
        business_id, user_id = self.connection_users[connection_id]
        resource_key = f"{business_id}:{draft_id or 'published'}:{resource_type}:{resource_id}"
        
        # Clean up expired locks
        await self._cleanup_expired_locks()
        
        # Check if resource is already locked
        if resource_key in self.edit_locks:
            lock_user_id, lock_time = self.edit_locks[resource_key]
            if lock_user_id != user_id:
                # Resource is locked by another user
                await self._send_lock_conflict(connection_id, resource_type, resource_id, lock_user_id)
                return False
        
        # Acquire lock
        self.edit_locks[resource_key] = (user_id, datetime.now())
        
        # Notify other users about the lock
        await self._broadcast_lock_update(business_id, draft_id, resource_type, resource_id, user_id, 'acquired')
        
        return True
    
    async def release_edit_lock(
        self, 
        connection_id: str, 
        resource_type: str, 
        resource_id: int,
        draft_id: Optional[str] = None
    ):
        """Release an edit lock for a resource"""
        if connection_id not in self.connection_users:
            return
        
        business_id, user_id = self.connection_users[connection_id]
        resource_key = f"{business_id}:{draft_id or 'published'}:{resource_type}:{resource_id}"
        
        if resource_key in self.edit_locks:
            lock_user_id, _ = self.edit_locks[resource_key]
            if lock_user_id == user_id:
                del self.edit_locks[resource_key]
                
                # Notify other users about the lock release
                await self._broadcast_lock_update(business_id, draft_id, resource_type, resource_id, user_id, 'released')
    
    async def record_edit(
        self, 
        connection_id: str, 
        operation: str,
        target_type: str,
        target_id: int,
        data: Dict[str, Any],
        draft_id: Optional[str] = None
    ) -> Optional[EditConflict]:
        """Record an edit operation and check for conflicts"""
        if connection_id not in self.connection_users:
            return None
        
        business_id, user_id = self.connection_users[connection_id]
        
        # Get user name
        user_name = "Unknown"
        if business_id in self.user_presence and user_id in self.user_presence[business_id]:
            user_name = self.user_presence[business_id][user_id].user_name
        
        # Create edit record
        edit = ScheduleEdit(
            edit_id=str(uuid.uuid4()),
            user_id=user_id,
            user_name=user_name,
            timestamp=datetime.now(),
            operation=operation,
            target_type=target_type,
            target_id=target_id,
            data=data,
            draft_id=draft_id
        )
        
        # Store edit
        draft_key = draft_id or f"business_{business_id}"
        if draft_key not in self.active_edits:
            self.active_edits[draft_key] = []
        self.active_edits[draft_key].append(edit)
        
        # Check for conflicts
        conflict = await self._detect_conflicts(edit)
        
        # Broadcast edit to other users
        await self._broadcast_edit_update(business_id, draft_id, edit, conflict)
        
        return conflict
    
    async def resolve_conflict(
        self, 
        connection_id: str, 
        conflict_id: str, 
        resolution: str,
        resolution_data: Optional[Dict[str, Any]] = None
    ):
        """Resolve a pending conflict"""
        if conflict_id not in self.pending_conflicts:
            return
        
        conflict = self.pending_conflicts[conflict_id]
        conflict.resolved = True
        conflict.resolution_data = resolution_data or {}
        
        # Apply resolution based on strategy
        if resolution == 'accept_edit1':
            # Keep edit1, discard edit2
            pass
        elif resolution == 'accept_edit2':
            # Keep edit2, discard edit1
            pass
        elif resolution == 'merge':
            # Merge both edits
            pass
        
        # Broadcast resolution
        if connection_id in self.connection_users:
            business_id, _ = self.connection_users[connection_id]
            await self._broadcast_conflict_resolution(business_id, conflict.edit1.draft_id, conflict)
        
        # Clean up resolved conflict
        del self.pending_conflicts[conflict_id]
    
    async def get_active_users(self, business_id: int, draft_id: Optional[str] = None) -> List[UserPresence]:
        """Get list of active users for a business/draft"""
        if business_id not in self.user_presence:
            return []
        
        users = []
        for user_presence in self.user_presence[business_id].values():
            if draft_id is None or user_presence.draft_id == draft_id:
                users.append(user_presence)
        
        return users
    
    async def broadcast_to_business(
        self, 
        business_id: int, 
        message: Dict[str, Any], 
        draft_id: Optional[str] = None,
        exclude_user: Optional[int] = None
    ):
        """Broadcast a message to all users in a business"""
        if business_id not in self.user_presence:
            return
        
        disconnected_connections = []
        
        for user_id, presence in self.user_presence[business_id].items():
            if exclude_user and user_id == exclude_user:
                continue
            
            if draft_id is None or presence.draft_id == draft_id:
                websocket = self.connections.get(presence.websocket_id)
                if websocket:
                    try:
                        await websocket.send_text(json.dumps(message))
                    except WebSocketDisconnect:
                        disconnected_connections.append(presence.websocket_id)
        
        # Clean up disconnected connections
        for connection_id in disconnected_connections:
            await self.disconnect_user(connection_id)
    
    # Private helper methods
    
    async def _broadcast_presence_update(self, business_id: int, draft_id: Optional[str] = None):
        """Broadcast presence update to all users"""
        active_users = await self.get_active_users(business_id, draft_id)
        
        # Convert users to dict with proper datetime serialization
        users_data = []
        for user in active_users:
            user_dict = asdict(user)
            user_dict['last_seen'] = user.last_seen.isoformat()
            users_data.append(user_dict)
        
        message = {
            "type": "presence_update",
            "users": users_data,
            "timestamp": datetime.now().isoformat()
        }
        
        await self.broadcast_to_business(business_id, message, draft_id)
    
    async def _send_current_presence(self, websocket: WebSocket, business_id: int, draft_id: Optional[str] = None):
        """Send current presence information to a specific user"""
        active_users = await self.get_active_users(business_id, draft_id)
        
        # Convert users to dict with proper datetime serialization
        users_data = []
        for user in active_users:
            user_dict = asdict(user)
            user_dict['last_seen'] = user.last_seen.isoformat()
            users_data.append(user_dict)
        
        message = {
            "type": "current_presence",
            "users": users_data,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            await websocket.send_text(json.dumps(message))
        except WebSocketDisconnect:
            pass
    
    async def _release_user_locks(self, user_id: int):
        """Release all locks held by a user"""
        locks_to_remove = []
        
        for resource_key, (lock_user_id, _) in self.edit_locks.items():
            if lock_user_id == user_id:
                locks_to_remove.append(resource_key)
        
        for resource_key in locks_to_remove:
            del self.edit_locks[resource_key]
    
    async def _cleanup_expired_locks(self):
        """Clean up expired edit locks"""
        current_time = datetime.now()
        expired_locks = []
        
        for resource_key, (user_id, lock_time) in self.edit_locks.items():
            if (current_time - lock_time).total_seconds() > self.lock_timeout:
                expired_locks.append(resource_key)
        
        for resource_key in expired_locks:
            del self.edit_locks[resource_key]
    
    async def _send_lock_conflict(self, connection_id: str, resource_type: str, resource_id: int, lock_user_id: int):
        """Send lock conflict notification to user"""
        websocket = self.connections.get(connection_id)
        if not websocket:
            return
        
        # Get lock user name
        lock_user_name = "Unknown"
        business_id, _ = self.connection_users[connection_id]
        if business_id in self.user_presence and lock_user_id in self.user_presence[business_id]:
            lock_user_name = self.user_presence[business_id][lock_user_id].user_name
        
        message = {
            "type": "lock_conflict",
            "resource_type": resource_type,
            "resource_id": resource_id,
            "locked_by_user_id": lock_user_id,
            "locked_by_user_name": lock_user_name,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            await websocket.send_text(json.dumps(message))
        except WebSocketDisconnect:
            pass
    
    async def _broadcast_lock_update(
        self, 
        business_id: int, 
        draft_id: Optional[str], 
        resource_type: str, 
        resource_id: int, 
        user_id: int, 
        action: str
    ):
        """Broadcast lock update to all users"""
        user_name = "Unknown"
        if business_id in self.user_presence and user_id in self.user_presence[business_id]:
            user_name = self.user_presence[business_id][user_id].user_name
        
        message = {
            "type": "lock_update",
            "resource_type": resource_type,
            "resource_id": resource_id,
            "user_id": user_id,
            "user_name": user_name,
            "action": action,  # 'acquired' or 'released'
            "timestamp": datetime.now().isoformat()
        }
        
        await self.broadcast_to_business(business_id, message, draft_id, exclude_user=user_id)
    
    async def _detect_conflicts(self, edit: ScheduleEdit) -> Optional[EditConflict]:
        """Detect conflicts with recent edits"""
        draft_key = edit.draft_id or f"business_{edit.user_id}"  # Fallback key
        
        if draft_key not in self.active_edits:
            return None
        
        # Look for recent conflicting edits (within last 5 seconds)
        recent_threshold = datetime.now() - timedelta(seconds=5)
        recent_edits = [
            e for e in self.active_edits[draft_key] 
            if e.timestamp > recent_threshold and e.edit_id != edit.edit_id
        ]
        
        for recent_edit in recent_edits:
            conflict_type = self._determine_conflict_type(edit, recent_edit)
            if conflict_type:
                conflict = EditConflict(
                    conflict_id=str(uuid.uuid4()),
                    edit1=recent_edit,
                    edit2=edit,
                    conflict_type=conflict_type,
                    resolution_strategy='last_write_wins'  # Default strategy
                )
                
                self.pending_conflicts[conflict.conflict_id] = conflict
                return conflict
        
        return None
    
    def _determine_conflict_type(self, edit1: ScheduleEdit, edit2: ScheduleEdit) -> Optional[str]:
        """Determine if two edits conflict and what type of conflict"""
        # Same target conflicts
        if edit1.target_type == edit2.target_type and edit1.target_id == edit2.target_id:
            if edit1.operation != edit2.operation:
                return 'concurrent_modification'
            else:
                return 'duplicate_operation'
        
        # Staff assignment conflicts
        if (edit1.operation == 'assign_staff' and edit2.operation == 'assign_staff' and
            edit1.data.get('staff_id') == edit2.data.get('staff_id')):
            return 'concurrent_assignment'
        
        # Resource conflicts (same staff being assigned to overlapping shifts)
        if (edit1.operation in ['assign_staff', 'unassign_staff'] and 
            edit2.operation in ['assign_staff', 'unassign_staff']):
            # Check for time overlap conflicts
            return self._check_time_overlap_conflict(edit1, edit2)
        
        return None
    
    def _check_time_overlap_conflict(self, edit1: ScheduleEdit, edit2: ScheduleEdit) -> Optional[str]:
        """Check if two staff assignments create a time overlap conflict"""
        # This would require shift time information to be passed in the edit data
        # For now, return None - this can be enhanced with actual time checking
        return None
    
    async def _broadcast_edit_update(
        self, 
        business_id: int, 
        draft_id: Optional[str], 
        edit: ScheduleEdit, 
        conflict: Optional[EditConflict]
    ):
        """Broadcast edit update to all users"""
        # Convert edit to dict with proper datetime serialization
        edit_dict = asdict(edit)
        edit_dict['timestamp'] = edit.timestamp.isoformat()
        
        # Convert conflict to dict with proper datetime serialization if present
        conflict_dict = None
        if conflict:
            conflict_dict = asdict(conflict)
            conflict_dict['edit1']['timestamp'] = conflict.edit1.timestamp.isoformat()
            conflict_dict['edit2']['timestamp'] = conflict.edit2.timestamp.isoformat()
        
        message = {
            "type": "edit_update",
            "edit": edit_dict,
            "conflict": conflict_dict,
            "timestamp": datetime.now().isoformat()
        }
        
        await self.broadcast_to_business(business_id, message, draft_id, exclude_user=edit.user_id)
    
    async def _broadcast_conflict_resolution(
        self, 
        business_id: int, 
        draft_id: Optional[str], 
        conflict: EditConflict
    ):
        """Broadcast conflict resolution to all users"""
        # Convert conflict to dict with proper datetime serialization
        conflict_dict = asdict(conflict)
        conflict_dict['edit1']['timestamp'] = conflict.edit1.timestamp.isoformat()
        conflict_dict['edit2']['timestamp'] = conflict.edit2.timestamp.isoformat()
        
        message = {
            "type": "conflict_resolved",
            "conflict": conflict_dict,
            "timestamp": datetime.now().isoformat()
        }
        
        await self.broadcast_to_business(business_id, message, draft_id)

# Global collaboration manager instance
collaboration_manager = CollaborationManager()