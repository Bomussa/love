#!/usr/bin/env python3
"""
تحليل شامل لمشروع نظام إدارة الطوابير الطبية
Comprehensive Analysis of Medical Queue Management System

المعايير: ISO 25010 - جودة البرمجيات
"""

import os
import re
import json
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = "/home/ubuntu/love/frontend/src"
OUTPUT_FILE = "/home/ubuntu/love/frontend/PROJECT_ANALYSIS.json"

def analyze_file(filepath):
    """تحليل ملف واحد"""
    result = {
        "path": filepath,
        "type": "jsx" if filepath.endswith(".jsx") else "js",
        "imports": [],
        "exports": [],
        "functions": [],
        "dependencies": [],
        "api_calls": [],
        "lines": 0,
        "issues": []
    }
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')
            result["lines"] = len(lines)
            
            # تحليل الاستيرادات
            import_pattern = r"import\s+(?:{[^}]+}|[\w]+)\s+from\s+['\"]([^'\"]+)['\"]"
            for match in re.finditer(import_pattern, content):
                result["imports"].append(match.group(1))
            
            # تحليل التصديرات
            export_pattern = r"export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class)\s+(\w+)"
            for match in re.finditer(export_pattern, content):
                result["exports"].append(match.group(1))
            
            # تحليل الدوال
            func_pattern = r"(?:async\s+)?(?:function\s+(\w+)|(\w+)\s*[:=]\s*async\s*\(|(\w+)\s*\([^)]*\)\s*{)"
            for match in re.finditer(func_pattern, content):
                func_name = match.group(1) or match.group(2) or match.group(3)
                if func_name and not func_name.startswith('_'):
                    result["functions"].append(func_name)
            
            # تحليل استدعاءات API
            api_pattern = r"(?:api|supabase|fetch)\s*\.\s*(\w+)"
            for match in re.finditer(api_pattern, content):
                result["api_calls"].append(match.group(1))
            
            # اكتشاف المشاكل
            # 1. استيراد من ملفات متعددة لنفس الوظيفة
            lib_imports = [i for i in result["imports"] if "lib/" in i]
            if len(lib_imports) > 3:
                result["issues"].append(f"كثرة الاستيرادات من lib: {len(lib_imports)}")
            
            # 2. استيراد من ملفات مكررة
            duplicate_sources = ["supabase-backend-api", "vercel-api-client", "supabase-direct"]
            for src in duplicate_sources:
                if any(src in i for i in result["imports"]):
                    result["issues"].append(f"استيراد من ملف مكرر: {src}")
            
    except Exception as e:
        result["issues"].append(f"خطأ في القراءة: {str(e)}")
    
    return result

def analyze_project():
    """تحليل المشروع بالكامل"""
    analysis = {
        "summary": {
            "total_files": 0,
            "jsx_files": 0,
            "js_files": 0,
            "total_lines": 0,
            "total_functions": 0,
            "total_issues": 0
        },
        "files": [],
        "lib_files": [],
        "component_files": [],
        "duplicates": defaultdict(list),
        "unused_files": [],
        "critical_issues": []
    }
    
    all_imports = set()
    all_exports = defaultdict(list)
    
    # جمع كل الملفات
    for root, dirs, files in os.walk(PROJECT_ROOT):
        # تجاهل المجلدات غير المهمة
        dirs[:] = [d for d in dirs if d not in ['node_modules', 'assets', '_archived', 'tests']]
        
        for file in files:
            if file.endswith(('.js', '.jsx')):
                filepath = os.path.join(root, file)
                file_analysis = analyze_file(filepath)
                analysis["files"].append(file_analysis)
                
                # تصنيف الملفات
                if "/lib/" in filepath:
                    analysis["lib_files"].append(file_analysis)
                elif "/components/" in filepath:
                    analysis["component_files"].append(file_analysis)
                
                # تحديث الإحصائيات
                analysis["summary"]["total_files"] += 1
                analysis["summary"]["total_lines"] += file_analysis["lines"]
                analysis["summary"]["total_functions"] += len(file_analysis["functions"])
                analysis["summary"]["total_issues"] += len(file_analysis["issues"])
                
                if file.endswith(".jsx"):
                    analysis["summary"]["jsx_files"] += 1
                else:
                    analysis["summary"]["js_files"] += 1
                
                # تتبع الاستيرادات والتصديرات
                for imp in file_analysis["imports"]:
                    all_imports.add(imp)
                
                for exp in file_analysis["exports"]:
                    all_exports[exp].append(filepath)
    
    # اكتشاف الدوال المكررة
    for func_name, files in all_exports.items():
        if len(files) > 1:
            analysis["duplicates"][func_name] = files
            analysis["critical_issues"].append({
                "type": "duplicate_function",
                "name": func_name,
                "files": files,
                "severity": "HIGH"
            })
    
    # اكتشاف الملفات غير المستخدمة
    for lib_file in analysis["lib_files"]:
        lib_name = Path(lib_file["path"]).stem
        is_used = False
        for comp_file in analysis["component_files"]:
            if lib_name in str(comp_file["imports"]):
                is_used = True
                break
        if not is_used:
            analysis["unused_files"].append(lib_file["path"])
    
    return analysis

def main():
    print("=" * 60)
    print("تحليل شامل لمشروع نظام إدارة الطوابير الطبية")
    print("=" * 60)
    
    analysis = analyze_project()
    
    # حفظ التحليل
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(analysis, f, ensure_ascii=False, indent=2)
    
    # طباعة الملخص
    print(f"\n📊 ملخص التحليل:")
    print(f"   - إجمالي الملفات: {analysis['summary']['total_files']}")
    print(f"   - ملفات JSX: {analysis['summary']['jsx_files']}")
    print(f"   - ملفات JS: {analysis['summary']['js_files']}")
    print(f"   - إجمالي الأسطر: {analysis['summary']['total_lines']}")
    print(f"   - إجمالي الدوال: {analysis['summary']['total_functions']}")
    print(f"   - إجمالي المشاكل: {analysis['summary']['total_issues']}")
    
    print(f"\n⚠️ الدوال المكررة ({len(analysis['duplicates'])}):")
    for func, files in list(analysis['duplicates'].items())[:10]:
        print(f"   - {func}: {len(files)} ملفات")
    
    print(f"\n📁 الملفات غير المستخدمة ({len(analysis['unused_files'])}):")
    for f in analysis['unused_files'][:10]:
        print(f"   - {Path(f).name}")
    
    print(f"\n🔴 المشاكل الحرجة ({len(analysis['critical_issues'])}):")
    for issue in analysis['critical_issues'][:5]:
        print(f"   - {issue['type']}: {issue['name']}")
    
    print(f"\n✅ تم حفظ التحليل الكامل في: {OUTPUT_FILE}")
    
    return analysis

if __name__ == "__main__":
    main()
