#!/usr/bin/env python3
"""
فحص التشابك والاعتماديات في المشروع
Dependency Chain Analysis
"""

import os
import re
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = "/home/ubuntu/love/frontend/src"

def get_all_imports(filepath):
    """استخراج جميع الاستيرادات من ملف"""
    imports = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
            # Pattern 1: import { x, y } from 'path'
            pattern1 = r"import\s+{([^}]+)}\s+from\s+['\"]([^'\"]+)['\"]"
            for match in re.finditer(pattern1, content):
                items = [i.strip() for i in match.group(1).split(',')]
                source = match.group(2)
                for item in items:
                    # Handle 'as' aliases
                    item_name = item.split(' as ')[0].strip()
                    imports.append({
                        'name': item_name,
                        'source': source,
                        'type': 'named'
                    })
            
            # Pattern 2: import x from 'path'
            pattern2 = r"import\s+(\w+)\s+from\s+['\"]([^'\"]+)['\"]"
            for match in re.finditer(pattern2, content):
                imports.append({
                    'name': match.group(1),
                    'source': match.group(2),
                    'type': 'default'
                })
                
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
    
    return imports

def resolve_path(source, current_file):
    """تحويل المسار النسبي إلى مسار مطلق"""
    if source.startswith('.'):
        current_dir = os.path.dirname(current_file)
        resolved = os.path.normpath(os.path.join(current_dir, source))
        # Try with .js and .jsx extensions
        for ext in ['', '.js', '.jsx']:
            full_path = resolved + ext
            if os.path.exists(full_path):
                return full_path
    return source

def analyze_dependencies():
    """تحليل سلسلة الاعتماديات"""
    
    # جمع كل الملفات
    all_files = []
    for root, dirs, files in os.walk(PROJECT_ROOT):
        dirs[:] = [d for d in dirs if d not in ['node_modules', 'assets', '_archived']]
        for file in files:
            if file.endswith(('.js', '.jsx')):
                all_files.append(os.path.join(root, file))
    
    # تحليل الاستيرادات لكل ملف
    file_imports = {}
    for filepath in all_files:
        file_imports[filepath] = get_all_imports(filepath)
    
    # بناء خريطة الاعتماديات
    dependency_map = defaultdict(list)  # file -> [files that depend on it]
    import_map = defaultdict(list)       # file -> [files it imports from]
    
    for filepath, imports in file_imports.items():
        for imp in imports:
            source = imp['source']
            if source.startswith('.'):
                resolved = resolve_path(source, filepath)
                if resolved and os.path.exists(resolved):
                    dependency_map[resolved].append({
                        'file': filepath,
                        'import_name': imp['name'],
                        'type': imp['type']
                    })
                    import_map[filepath].append({
                        'source': resolved,
                        'name': imp['name']
                    })
    
    return dependency_map, import_map, file_imports

def check_file_usage(target_file):
    """فحص استخدام ملف معين"""
    dependency_map, import_map, _ = analyze_dependencies()
    
    short_name = target_file.replace(PROJECT_ROOT + '/', '')
    print(f"\n{'='*70}")
    print(f"فحص استخدام: {short_name}")
    print(f"{'='*70}")
    
    if target_file in dependency_map:
        dependents = dependency_map[target_file]
        print(f"\n✅ يُستخدم في {len(dependents)} ملف:")
        for dep in dependents:
            dep_short = dep['file'].replace(PROJECT_ROOT + '/', '')
            print(f"   - {dep_short}")
            print(f"     يستورد: {dep['import_name']} ({dep['type']})")
    else:
        print(f"\n❌ لا يُستخدم في أي ملف")
    
    # فحص ما يستورده هذا الملف
    if target_file in import_map:
        imports = import_map[target_file]
        print(f"\n📥 يستورد من {len(imports)} ملف:")
        for imp in imports:
            imp_short = imp['source'].replace(PROJECT_ROOT + '/', '')
            print(f"   - {imp_short}: {imp['name']}")

def main():
    print("=" * 70)
    print("تحليل التشابك والاعتماديات")
    print("=" * 70)
    
    # الملفات المراد فحصها
    files_to_check = [
        "lib/supabase-backend-api.js",
        "lib/vercel-api-client.js",
        "lib/supabase-api.js",
        "lib/supabase-queries.js",
        "lib/guaranteed-data-system.js",
        "lib/supabase-direct.js",
        "lib/queueManager.js",
        "lib/realtime-service.js",
        "lib/api-unified.js"
    ]
    
    dependency_map, import_map, file_imports = analyze_dependencies()
    
    print("\n" + "=" * 70)
    print("ملخص الاعتماديات")
    print("=" * 70)
    
    for file_path in files_to_check:
        full_path = os.path.join(PROJECT_ROOT, file_path)
        if os.path.exists(full_path):
            check_file_usage(full_path)
    
    # طباعة الملفات الأكثر استخداماً
    print("\n" + "=" * 70)
    print("الملفات الأكثر استخداماً (Top 10)")
    print("=" * 70)
    
    usage_count = [(f, len(deps)) for f, deps in dependency_map.items()]
    usage_count.sort(key=lambda x: x[1], reverse=True)
    
    for filepath, count in usage_count[:10]:
        short = filepath.replace(PROJECT_ROOT + '/', '')
        print(f"   {count:3d} مرة: {short}")

if __name__ == "__main__":
    main()
