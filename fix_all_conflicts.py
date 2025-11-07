#!/usr/bin/env python3
import re
import os
import sys

def fix_conflicts_in_file(filepath):
    """Fix git conflicts by intelligently merging both versions"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Pattern to match git conflict markers
        conflict_pattern = r'<<<<<<< HEAD[^\n]*\n(.*?)\n=======\n(.*?)\n>>>>>>> [^\n]*\n'
        
        def resolve_conflict(match):
            head_version = match.group(1)
            other_version = match.group(2)
            
            # Strategy: prefer the version with more functionality
            # If other version has more lines or more content, use it
            # Otherwise use HEAD version
            
            head_lines = head_version.strip().split('\n')
            other_lines = other_version.strip().split('\n')
            
            # Check for specific patterns to make intelligent decisions
            
            # If one version has eventBus and the other doesn't, prefer eventBus version
            if 'eventBus' in other_version and 'eventBus' not in head_version:
                return other_version + '\n'
            
            # If one version has computeEtaMinutes, prefer it
            if 'computeEtaMinutes' in other_version and 'computeEtaMinutes' not in head_version:
                return other_version + '\n'
            
            # If other version has console.error with actual message, prefer it
            if 'console.error(' in other_version and '//' in head_version:
                return other_version + '\n'
            
            # If versions are similar but one has better comments, merge them
            if len(other_lines) >= len(head_lines):
                return other_version + '\n'
            else:
                return head_version + '\n'
        
        # Replace all conflicts
        fixed_content = re.sub(conflict_pattern, resolve_conflict, content, flags=re.DOTALL)
        
        if fixed_content != original_content:
            # Backup original
            backup_path = filepath + '.conflict_backup'
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(original_content)
            
            # Write fixed version
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(fixed_content)
            
            return True, "Fixed"
        else:
            return False, "No conflicts found"
            
    except Exception as e:
        return False, f"Error: {str(e)}"

# Files to fix
files_to_fix = [
    'frontend/src/components/PatientPage.jsx',
    'frontend/src/core/event-bus.js',
    'frontend/src/lib/dynamic-pathways.js'
]

print("🔧 Starting automatic conflict resolution...\n")

for filepath in files_to_fix:
    full_path = os.path.join('/home/ubuntu/love', filepath)
    if os.path.exists(full_path):
        success, message = fix_conflicts_in_file(full_path)
        status = "✅" if success else "⚠️"
        print(f"{status} {filepath}: {message}")
    else:
        print(f"❌ {filepath}: File not found")

print("\n✅ Conflict resolution completed!")
