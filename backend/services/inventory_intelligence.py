from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from models import InventoryItem, Supplier, InventoryPrediction, Business
from services.ai import AIService
import json

class InventoryIntelligence:
    def __init__(self, db: Session):
        self.db = db
        self.ai_service = AIService()
    
    async def predict_inventory_needs(self, business_id: int) -> Dict:
        """Predict inventory needs using AI"""
        
        # Get current inventory
        current_stock = await self.get_current_stock(business_id)
        
        # Get usage history
        usage_history = await self.get_usage_history(business_id, days=30)
        
        # Get upcoming events
        upcoming_events = await self.get_upcoming_events(business_id)
        
        # AI prediction
        ai_prediction = await self.ai_service.analyze_inventory_needs(
            current_stock, usage_history, upcoming_events
        )
        
        # Store predictions
        await self.store_predictions(business_id, ai_prediction)
        
        return {
            "prediction_date": datetime.now().isoformat(),
            "current_stock_items": len(current_stock),
            "reorder_recommendations": ai_prediction.get("reorder_items", []),
            "expiry_alerts": ai_prediction.get("expiry_risks", []),
            "cost_savings": ai_prediction.get("cost_savings", []),
            "confidence_score": ai_prediction.get("confidence", 0.8)
        }
    
    async def get_current_stock(self, business_id: int) -> Dict:
        """Get current inventory stock levels"""
        
        items = self.db.query(InventoryItem).filter(
            InventoryItem.business_id == business_id,
            InventoryItem.is_active == True
        ).all()
        
        stock_data = {}
        for item in items:
            stock_data[item.name] = {
                "current_stock": item.current_stock,
                "minimum_stock": item.minimum_stock,
                "maximum_stock": item.maximum_stock,
                "unit": item.unit,
                "category": item.category,
                "cost_per_unit": item.cost_per_unit,
                "stock_ratio": item.current_stock / item.minimum_stock if item.minimum_stock > 0 else 1
            }
        
        return stock_data
    
    async def get_usage_history(self, business_id: int, days: int = 30) -> Dict:
        """Get historical usage patterns"""
        
        # Mock usage data - would integrate with POS/inventory system
        usage_patterns = {
            "tomatoes": {"daily_avg": 5.2, "trend": "stable", "peak_days": ["friday", "saturday"]},
            "chicken": {"daily_avg": 8.1, "trend": "increasing", "peak_days": ["saturday", "sunday"]},
            "lettuce": {"daily_avg": 3.5, "trend": "stable", "peak_days": ["friday", "saturday"]},
            "bread": {"daily_avg": 12.0, "trend": "stable", "peak_days": ["saturday", "sunday"]},
            "cheese": {"daily_avg": 4.8, "trend": "decreasing", "peak_days": ["friday", "saturday"]}
        }
        
        return usage_patterns
    
    async def get_upcoming_events(self, business_id: int) -> List[Dict]:
        """Get upcoming events that might affect inventory needs"""
        
        # Mock events data - would integrate with events API
        return [
            {
                "name": "Local Food Festival",
                "date": (date.today() + timedelta(days=3)).isoformat(),
                "expected_impact": "high",
                "affected_categories": ["produce", "meat"]
            },
            {
                "name": "Weekend Football Match",
                "date": (date.today() + timedelta(days=5)).isoformat(),
                "expected_impact": "medium",
                "affected_categories": ["beverages", "snacks"]
            }
        ]
    
    async def store_predictions(self, business_id: int, predictions: Dict):
        """Store AI predictions in database"""
        
        items = self.db.query(InventoryItem).filter(
            InventoryItem.business_id == business_id
        ).all()
        
        for item in items:
            # Find prediction for this item
            item_prediction = None
            for pred in predictions.get("reorder_items", []):
                if pred.get("item_name") == item.name:
                    item_prediction = pred
                    break
            
            if item_prediction:
                prediction = InventoryPrediction(
                    business_id=business_id,
                    item_id=item.id,
                    prediction_date=date.today(),
                    predicted_usage=item_prediction.get("predicted_usage", 0),
                    reorder_recommendation=item_prediction.get("reorder_quantity", 0),
                    urgency_level=item_prediction.get("urgency", "normal"),
                    factors=item_prediction.get("factors", {})
                )
                self.db.add(prediction)
        
        self.db.commit()
    
    async def generate_smart_orders(self, business_id: int) -> Dict:
        """Generate smart reorder recommendations"""
        
        predictions = await self.predict_inventory_needs(business_id)
        
        orders = []
        total_cost = 0
        
        for reorder_item in predictions.get("reorder_recommendations", []):
            # Get item details
            item = self.db.query(InventoryItem).filter(
                InventoryItem.business_id == business_id,
                InventoryItem.name == reorder_item.get("item_name")
            ).first()
            
            if item and item.supplier_id:
                supplier = self.db.query(Supplier).filter(
                    Supplier.id == item.supplier_id
                ).first()
                
                order_cost = reorder_item.get("quantity", 0) * (item.cost_per_unit or 0)
                total_cost += order_cost
                
                orders.append({
                    "item_name": item.name,
                    "supplier": supplier.name if supplier else "Unknown",
                    "quantity": reorder_item.get("quantity", 0),
                    "unit": item.unit,
                    "unit_cost": item.cost_per_unit,
                    "total_cost": order_cost,
                    "urgency": reorder_item.get("urgency", "normal"),
                    "delivery_days": supplier.average_delivery_days if supplier else 2
                })
        
        return {
            "orders": orders,
            "total_cost": round(total_cost, 2),
            "estimated_savings": await self.calculate_potential_savings(business_id, orders),
            "delivery_schedule": self.optimize_delivery_schedule(orders)
        }
    
    async def calculate_potential_savings(self, business_id: int, orders: List[Dict]) -> Dict:
        """Calculate potential cost savings from optimized ordering"""
        
        # Mock savings calculation
        total_order_value = sum(order["total_cost"] for order in orders)
        
        savings = {
            "bulk_discount": total_order_value * 0.05,  # 5% bulk discount
            "waste_reduction": total_order_value * 0.08,  # 8% waste reduction
            "emergency_order_avoidance": 150,  # Avoid emergency delivery fees
            "total_savings": 0
        }
        
        savings["total_savings"] = sum(savings.values()) - savings["total_savings"]
        
        return {k: round(v, 2) for k, v in savings.items()}
    
    def optimize_delivery_schedule(self, orders: List[Dict]) -> List[Dict]:
        """Optimize delivery schedule to minimize costs"""
        
        # Group by delivery days and urgency
        delivery_groups = {}
        
        for order in orders:
            delivery_days = order.get("delivery_days", 2)
            urgency = order.get("urgency", "normal")
            
            # Urgent items get faster delivery
            if urgency in ["high", "critical"]:
                delivery_days = 1
            
            delivery_date = (date.today() + timedelta(days=delivery_days)).isoformat()
            
            if delivery_date not in delivery_groups:
                delivery_groups[delivery_date] = []
            
            delivery_groups[delivery_date].append(order)
        
        schedule = []
        for delivery_date, items in delivery_groups.items():
            schedule.append({
                "delivery_date": delivery_date,
                "items": items,
                "total_cost": sum(item["total_cost"] for item in items),
                "item_count": len(items)
            })
        
        return sorted(schedule, key=lambda x: x["delivery_date"])
    
    async def track_waste_patterns(self, business_id: int, days: int = 30) -> Dict:
        """Track and analyze waste patterns"""
        
        # Mock waste data - would integrate with waste tracking system
        waste_data = {
            "total_waste_cost": 245.50,
            "waste_by_category": {
                "produce": {"cost": 120.30, "percentage": 49},
                "dairy": {"cost": 45.20, "percentage": 18},
                "meat": {"cost": 80.00, "percentage": 33}
            },
            "waste_trends": [
                {"date": (date.today() - timedelta(days=i)).isoformat(), 
                 "waste_cost": 8.5 + (i % 3) * 2.1}
                for i in range(days)
            ],
            "top_wasted_items": [
                {"item": "Lettuce", "cost": 35.20, "reason": "Expiry"},
                {"item": "Tomatoes", "cost": 28.50, "reason": "Over-ordering"},
                {"item": "Milk", "cost": 22.10, "reason": "Expiry"}
            ]
        }
        
        # Generate recommendations
        recommendations = []
        if waste_data["waste_by_category"]["produce"]["percentage"] > 40:
            recommendations.append("High produce waste - consider smaller, more frequent orders")
        
        if any(item["reason"] == "Expiry" for item in waste_data["top_wasted_items"]):
            recommendations.append("Implement FIFO (First In, First Out) inventory rotation")
        
        waste_data["recommendations"] = recommendations
        
        return waste_data
    
    async def get_supplier_performance(self, business_id: int) -> List[Dict]:
        """Analyze supplier performance"""
        
        suppliers = self.db.query(Supplier).filter(
            Supplier.business_id == business_id
        ).all()
        
        performance_data = []
        
        for supplier in suppliers:
            # Mock performance data
            performance = {
                "supplier_id": supplier.id,
                "name": supplier.name,
                "reliability_score": supplier.reliability_score,
                "average_delivery_days": supplier.average_delivery_days,
                "categories": supplier.categories or [],
                "is_preferred": supplier.is_preferred,
                "recent_orders": 12,  # Mock data
                "on_time_delivery_rate": 85 + (supplier.reliability_score * 2),
                "quality_score": supplier.reliability_score * 10,
                "cost_competitiveness": "good" if supplier.reliability_score > 7 else "average"
            }
            
            performance_data.append(performance)
        
        # Sort by overall performance
        performance_data.sort(key=lambda x: x["reliability_score"], reverse=True)
        
        return performance_data
    
    async def create_inventory_alerts(self, business_id: int) -> List[Dict]:
        """Create inventory alerts for low stock, expiry, etc."""
        
        items = self.db.query(InventoryItem).filter(
            InventoryItem.business_id == business_id,
            InventoryItem.is_active == True
        ).all()
        
        alerts = []
        
        for item in items:
            # Low stock alert
            if item.current_stock <= item.minimum_stock:
                urgency = "critical" if item.current_stock == 0 else "high"
                alerts.append({
                    "type": "low_stock",
                    "item_name": item.name,
                    "current_stock": item.current_stock,
                    "minimum_stock": item.minimum_stock,
                    "urgency": urgency,
                    "message": f"{item.name} is running low ({item.current_stock} {item.unit} remaining)"
                })
            
            # Overstock alert
            if item.maximum_stock and item.current_stock > item.maximum_stock:
                alerts.append({
                    "type": "overstock",
                    "item_name": item.name,
                    "current_stock": item.current_stock,
                    "maximum_stock": item.maximum_stock,
                    "urgency": "medium",
                    "message": f"{item.name} is overstocked ({item.current_stock} {item.unit})"
                })
        
        # Sort by urgency
        urgency_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        alerts.sort(key=lambda x: urgency_order.get(x["urgency"], 3))
        
        return alerts
    
    async def get_inventory_dashboard(self, business_id: int) -> Dict:
        """Get comprehensive inventory dashboard data"""
        
        # Get current stock status
        items = self.db.query(InventoryItem).filter(
            InventoryItem.business_id == business_id,
            InventoryItem.is_active == True
        ).all()
        
        total_items = len(items)
        low_stock_items = len([i for i in items if i.current_stock <= i.minimum_stock])
        out_of_stock = len([i for i in items if i.current_stock == 0])
        
        # Calculate total inventory value
        total_value = sum((item.current_stock * (item.cost_per_unit or 0)) for item in items)
        
        # Get recent predictions
        recent_predictions = self.db.query(InventoryPrediction).filter(
            InventoryPrediction.business_id == business_id,
            InventoryPrediction.prediction_date >= date.today() - timedelta(days=7)
        ).count()
        
        return {
            "overview": {
                "total_items": total_items,
                "low_stock_items": low_stock_items,
                "out_of_stock_items": out_of_stock,
                "total_inventory_value": round(total_value, 2),
                "stock_health_score": max(0, 100 - (low_stock_items / total_items * 100)) if total_items > 0 else 100
            },
            "alerts": await self.create_inventory_alerts(business_id),
            "recent_predictions": recent_predictions,
            "top_categories": await self.get_category_breakdown(business_id),
            "supplier_summary": len(self.db.query(Supplier).filter(Supplier.business_id == business_id).all())
        }
    
    async def get_category_breakdown(self, business_id: int) -> List[Dict]:
        """Get inventory breakdown by category"""
        
        items = self.db.query(InventoryItem).filter(
            InventoryItem.business_id == business_id,
            InventoryItem.is_active == True
        ).all()
        
        categories = {}
        
        for item in items:
            category = item.category or "uncategorized"
            if category not in categories:
                categories[category] = {
                    "item_count": 0,
                    "total_value": 0,
                    "low_stock_count": 0
                }
            
            categories[category]["item_count"] += 1
            categories[category]["total_value"] += item.current_stock * (item.cost_per_unit or 0)
            
            if item.current_stock <= item.minimum_stock:
                categories[category]["low_stock_count"] += 1
        
        # Convert to list and sort by value
        category_list = [
            {
                "category": cat,
                "item_count": data["item_count"],
                "total_value": round(data["total_value"], 2),
                "low_stock_count": data["low_stock_count"],
                "health_score": max(0, 100 - (data["low_stock_count"] / data["item_count"] * 100))
            }
            for cat, data in categories.items()
        ]
        
        category_list.sort(key=lambda x: x["total_value"], reverse=True)
        
        return category_list