from typing import Set
from enum import Enum

class Permission(Enum):
    # Report permissions
    CREATE_REPORT = "create_report"
    READ_REPORT = "read_report"
    UPDATE_REPORT = "update_report"
    DELETE_REPORT = "delete_report"
    REVIEW_REPORT = "review_report"
    OVERRIDE_AI_LABEL = "override_ai_label"
    
    # Work order permissions
    CREATE_WORK_ORDER = "create_work_order"
    READ_WORK_ORDER = "read_work_order"
    UPDATE_WORK_ORDER = "update_work_order"
    DELETE_WORK_ORDER = "delete_work_order"
    ASSIGN_WORK_ORDER = "assign_work_order"
    CLOSE_WORK_ORDER = "close_work_order"
    
    # Asset permissions
    READ_ASSET = "read_asset"
    CREATE_ASSET = "create_asset"
    UPDATE_ASSET = "update_asset"
    DELETE_ASSET = "delete_asset"
    
    # Map permissions
    READ_FLOOD_MAP = "read_flood_map"
    READ_DRAINAGE_MAP = "read_drainage_map"
    
    # User management permissions
    READ_USER = "read_user"
    CREATE_USER = "create_user"
    UPDATE_USER = "update_user"
    DELETE_USER = "delete_user"
    
    # AI threshold permissions
    READ_THRESHOLD = "read_threshold"
    UPDATE_THRESHOLD = "update_threshold"
    
    # AI Camera permissions
    MANAGE_AI_CAMERAS = "manage_ai_cameras"
    
    # Full control
    FULL_CONTROL = "full_control"

# Role to permissions mapping based on the RBAC matrix
ROLE_PERMISSIONS: dict[str, Set[Permission]] = {
    "citizen": {
        Permission.CREATE_REPORT,
        Permission.READ_REPORT,
        Permission.READ_FLOOD_MAP,
    },
    "crew": {
        Permission.READ_WORK_ORDER,
        Permission.UPDATE_WORK_ORDER,
        Permission.READ_DRAINAGE_MAP,
    },
    "technician": {
        Permission.CREATE_WORK_ORDER,
        Permission.READ_REPORT,
        Permission.READ_WORK_ORDER,
        Permission.REVIEW_REPORT,
        Permission.OVERRIDE_AI_LABEL,
        Permission.ASSIGN_WORK_ORDER,
        Permission.CLOSE_WORK_ORDER,
        Permission.READ_DRAINAGE_MAP,
        Permission.READ_FLOOD_MAP,
    },
    "engineer": {
        Permission.READ_REPORT,
        Permission.REVIEW_REPORT,
        Permission.OVERRIDE_AI_LABEL,
        Permission.READ_FLOOD_MAP,
        Permission.READ_DRAINAGE_MAP,
        Permission.READ_THRESHOLD,
    },
    "admin": {
        # All permissions
        Permission.FULL_CONTROL,
        Permission.MANAGE_AI_CAMERAS,
    }
}

def get_permissions_for_role(role: str) -> Set[Permission]:
    """Get all permissions for a given role."""
    return ROLE_PERMISSIONS.get(role, set())

def has_permission(role: str, permission: Permission) -> bool:
    """Check if a role has a specific permission."""
    permissions = get_permissions_for_role(role)
    if Permission.FULL_CONTROL in permissions:
        return True
    return permission in permissions

def require_permissions(*required_permissions: Permission):
    """
    Decorator factory to check if user has all required permissions.
    Returns a dependency that can be used in FastAPI endpoints.
    """
    from fastapi import Depends, HTTPException
    from .security import current_user
    from .models import User
    
    def check_permissions(u: User = Depends(current_user)):
        for perm in required_permissions:
            if not has_permission(u.role, perm):
                raise HTTPException(403, f"Missing permission: {perm.value}")
        return u
    return check_permissions

def require_any_permission(*permissions: Permission):
    """
    Decorator factory to check if user has at least one of the required permissions.
    Returns a dependency that can be used in FastAPI endpoints.
    """
    from fastapi import Depends, HTTPException
    from .security import current_user
    from .models import User
    
    def check_permissions(u: User = Depends(current_user)):
        if not any(has_permission(u.role, perm) for perm in permissions):
            raise HTTPException(403, f"Missing one of required permissions: {[p.value for p in permissions]}")
        return u
    return check_permissions
