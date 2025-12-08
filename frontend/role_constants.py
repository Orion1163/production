"""
Role constants and mappings for role-based access control.
"""

# Role ID to Role Name mapping
ROLE_NAMES = {
    1: "Administrator",
    2: "Quality Control",
    3: "Tester",
    4: "Glueing",
    5: "Cleaning",
    6: "Spraying",
    7: "Dispatch",
    8: "Kit Verification",
    9: "SMD",
    10: "SMD QC",
    11: "Pre-Forming QC",
    12: "Leaded QC",
    13: "Production QC",
}

# Role ID to Section Keys mapping
# '*' means access to all sections
ROLE_SECTION_MAPPING = {
    1: ['*'],  # Administrator - all sections
    2: ['qc'],  # Quality Control
    3: ['testing', 'heat_run'],  # Tester
    4: ['glueing'],  # Glueing
    5: ['cleaning'],  # Cleaning
    6: ['spraying'],  # Spraying
    7: ['dispatch'],  # Dispatch
    8: ['kit'],  # Kit Verification
    9: ['smd'],  # SMD
    10: ['smd_qc'],  # SMD QC
    11: ['pre_forming_qc'],  # Pre-Forming QC
    12: ['leaded_qc'],  # Leaded QC
    13: ['prod_qc'],  # Production QC
}

# Section key to Role IDs mapping (reverse lookup)
SECTION_ROLE_MAPPING = {
    'kit': [1, 8],
    'smd': [1, 9],
    'smd_qc': [1, 10],
    'pre_forming_qc': [1, 11],
    'accessories_packing': [1],  # Only admin for now
    'leaded_qc': [1, 12],
    'prod_qc': [1, 13],
    'qc': [1, 2],
    'testing': [1, 3],
    'heat_run': [1, 3],
    'glueing': [1, 4],
    'cleaning': [1, 5],
    'spraying': [1, 6],
    'dispatch': [1, 7],
}

# All available sections
ALL_SECTIONS = [
    'kit', 'smd', 'smd_qc', 'pre_forming_qc', 'accessories_packing',
    'leaded_qc', 'prod_qc', 'qc', 'testing', 'heat_run',
    'glueing', 'cleaning', 'spraying', 'dispatch'
]

# Section display names
SECTION_NAMES = {
    'kit': 'Kit Verification',
    'smd': 'SMD',
    'smd_qc': 'SMD QC',
    'pre_forming_qc': 'Pre-Forming QC',
    'accessories_packing': 'Accessories Packing',
    'leaded_qc': 'Leaded QC',
    'prod_qc': 'Production QC',
    'qc': 'QC',
    'testing': 'Testing',
    'heat_run': 'Heat Run',
    'glueing': 'Glueing',
    'cleaning': 'Cleaning',
    'spraying': 'Spraying',
    'dispatch': 'Dispatch'
}


def has_role_access(user_roles, section_key):
    """
    Check if user has access to a specific section based on their roles.
    
    Args:
        user_roles: List of role IDs (integers)
        section_key: Section key string (e.g., 'kit', 'smd', etc.)
    
    Returns:
        bool: True if user has access, False otherwise
    """
    if not user_roles:
        return False
    
    # Convert to list if not already
    if not isinstance(user_roles, list):
        user_roles = [user_roles]
    
    # Check if user is Administrator (role 1) - has access to everything
    if 1 in user_roles:
        return True
    
    # Check if any of user's roles grant access to this section
    allowed_roles = SECTION_ROLE_MAPPING.get(section_key, [])
    return any(role in allowed_roles for role in user_roles)


def get_accessible_sections(user_roles):
    """
    Get all sections accessible by user based on their roles.
    
    Args:
        user_roles: List of role IDs (integers)
    
    Returns:
        list: List of section keys the user can access
    """
    if not user_roles:
        return []
    
    # Convert to list if not already
    if not isinstance(user_roles, list):
        user_roles = [user_roles]
    
    # Administrator has access to all sections
    if 1 in user_roles:
        return ALL_SECTIONS.copy()
    
    # Collect all accessible sections from user's roles
    accessible_sections = set()
    for role_id in user_roles:
        sections = ROLE_SECTION_MAPPING.get(role_id, [])
        if '*' in sections:
            return ALL_SECTIONS.copy()
        accessible_sections.update(sections)
    
    return list(accessible_sections)


def get_role_name(role_id):
    """Get role name by role ID."""
    return ROLE_NAMES.get(role_id, f"Unknown Role ({role_id})")


def is_admin(user_roles):
    """Check if user is an administrator."""
    if not user_roles:
        return False
    if not isinstance(user_roles, list):
        user_roles = [user_roles]
    return 1 in user_roles

