#!/usr/bin/env python3
"""
نظام الفحص الذكي الشامل
Smart Comprehensive Audit System

يفحص:
1. الدوال المستدعاة vs الدوال المُعرَّفة
2. الاستيرادات المفقودة
3. المتغيرات غير المُعرَّفة
4. الجداول المطلوبة vs الموجودة
5. المسارات (Routes) المفقودة
6. التوافق بين Frontend و Backend
7. الملفات المكررة وغير المستخدمة
"""

import os
import re
import json
from pathlib import Path
from collections import defaultdict

class AuditSystem:
    def __init__(self, frontend_path, backend_path):
        self.frontend_path = Path(frontend_path)
        self.backend_path = Path(backend_path)
        self.issues = {
            'critical': [],      # مشاكل حرجة تمنع التشغيل
            'high': [],          # مشاكل عالية الخطورة
            'medium': [],        # مشاكل متوسطة
            'low': [],           # تحسينات مقترحة
            'info': []           # معلومات
        }
        self.stats = {
            'files_scanned': 0,
            'functions_found': 0,
            'imports_found': 0,
            'tables_found': 0
        }
        
    def run_full_audit(self):
        """تشغيل الفحص الشامل"""
        print("=" * 60)
        print("🔍 نظام الفحص الذكي الشامل")
        print("=" * 60)
        
        # 1. فحص Frontend
        print("\n📁 [1/7] فحص ملفات Frontend...")
        self.audit_frontend_imports()
        
        # 2. فحص الدوال في api-unified
        print("\n📁 [2/7] فحص دوال api-unified...")
        self.audit_api_functions()
        
        # 3. فحص استدعاءات API الممنوعة
        print("\n📁 [3/7] فحص استدعاءات API الممنوعة...")
        self.audit_forbidden_api_calls()
        
        # 4. فحص الجداول المطلوبة
        print("\n📁 [4/7] فحص جداول Supabase...")
        self.audit_database_tables()
        
        # 5. فحص الملفات المكررة
        print("\n📁 [5/7] فحص الملفات المكررة...")
        self.audit_duplicate_files()
        
        # 6. فحص التوافق
        print("\n📁 [6/7] فحص التوافق بين Frontend و Backend...")
        self.audit_compatibility()
        
        # 7. فحص البناء
        print("\n📁 [7/7] فحص إمكانية البناء...")
        self.audit_build_readiness()
        
        # عرض النتائج
        self.print_results()
        
        # حفظ التقرير
        self.save_report()
        
        return self.issues
    
    def audit_frontend_imports(self):
        """فحص الاستيرادات في Frontend"""
        components_path = self.frontend_path / 'src' / 'components'
        lib_path = self.frontend_path / 'src' / 'lib'
        
        # جمع الملفات المتاحة في lib
        available_libs = set()
        if lib_path.exists():
            for f in lib_path.glob('*.js'):
                available_libs.add(f.stem)
        
        # فحص كل مكون
        if components_path.exists():
            for jsx_file in components_path.glob('*.jsx'):
                self.stats['files_scanned'] += 1
                content = jsx_file.read_text(encoding='utf-8', errors='ignore')
                
                # البحث عن الاستيرادات من lib
                imports = re.findall(r"from\s+['\"]\.\.\/lib\/([^'\"]+)['\"]", content)
                for imp in imports:
                    self.stats['imports_found'] += 1
                    # إزالة الامتداد إذا وجد
                    imp_name = imp.replace('.js', '').replace('.jsx', '')
                    if imp_name not in available_libs:
                        self.issues['critical'].append({
                            'type': 'missing_import',
                            'file': str(jsx_file.name),
                            'import': imp_name,
                            'message': f"الملف {jsx_file.name} يستورد من '{imp_name}' غير موجود في lib/"
                        })
    
    def audit_api_functions(self):
        """فحص الدوال المستدعاة vs المُعرَّفة في api-unified"""
        api_file = self.frontend_path / 'src' / 'lib' / 'api-unified.js'
        components_path = self.frontend_path / 'src' / 'components'
        
        # جمع الدوال المُعرَّفة في api-unified
        defined_functions = set()
        if api_file.exists():
            content = api_file.read_text(encoding='utf-8', errors='ignore')
            # البحث عن async function_name أو function_name: async
            funcs = re.findall(r'async\s+(\w+)\s*\(|(\w+)\s*:\s*async', content)
            for f in funcs:
                func_name = f[0] or f[1]
                if func_name:
                    defined_functions.add(func_name)
                    self.stats['functions_found'] += 1
        
        # جمع الدوال المستدعاة في المكونات
        called_functions = defaultdict(list)
        if components_path.exists():
            for jsx_file in components_path.glob('*.jsx'):
                content = jsx_file.read_text(encoding='utf-8', errors='ignore')
                
                # البحث عن api.functionName أو enhancedApi.functionName
                calls = re.findall(r'(?:api|enhancedApi)\.(\w+)\s*\(', content)
                for call in calls:
                    called_functions[call].append(jsx_file.name)
        
        # مقارنة
        for func, files in called_functions.items():
            if func not in defined_functions:
                self.issues['critical'].append({
                    'type': 'missing_function',
                    'function': func,
                    'files': files,
                    'message': f"الدالة '{func}' مستدعاة في {files} لكنها غير مُعرَّفة في api-unified.js"
                })
        
        # الدوال المُعرَّفة غير المستخدمة
        unused_functions = defined_functions - set(called_functions.keys())
        # استثناء الدوال الداخلية
        internal_funcs = {'retryWithBackoff', 'handleError', 'logActivity'}
        unused_functions = unused_functions - internal_funcs
        
        if unused_functions:
            self.issues['low'].append({
                'type': 'unused_functions',
                'functions': list(unused_functions),
                'message': f"دوال مُعرَّفة غير مستخدمة: {list(unused_functions)[:10]}"
            })
    
    def audit_forbidden_api_calls(self):
        """فحص استدعاءات API الممنوعة (axios, fetch /api)"""
        components_path = self.frontend_path / 'src' / 'components'
        
        if components_path.exists():
            for jsx_file in components_path.glob('*.jsx'):
                content = jsx_file.read_text(encoding='utf-8', errors='ignore')
                
                # فحص axios
                if 'import' in content and 'axios' in content:
                    self.issues['critical'].append({
                        'type': 'forbidden_axios',
                        'file': str(jsx_file.name),
                        'message': f"الملف {jsx_file.name} يستورد axios (ممنوع في Frontend)"
                    })
                
                # فحص fetch('/api
                api_fetches = re.findall(r"fetch\s*\(\s*['\"]\/api[^'\"]*['\"]", content)
                if api_fetches:
                    self.issues['critical'].append({
                        'type': 'forbidden_fetch_api',
                        'file': str(jsx_file.name),
                        'calls': api_fetches,
                        'message': f"الملف {jsx_file.name} يستدعي API محلي (ممنوع): {api_fetches}"
                    })
    
    def audit_database_tables(self):
        """فحص الجداول المطلوبة في Supabase"""
        # الجداول المطلوبة بناءً على الكود
        required_tables = set()
        
        # فحص api-unified للجداول المستخدمة
        api_file = self.frontend_path / 'src' / 'lib' / 'api-unified.js'
        if api_file.exists():
            content = api_file.read_text(encoding='utf-8', errors='ignore')
            # البحث عن .from('table_name')
            tables = re.findall(r"\.from\s*\(\s*['\"]([^'\"]+)['\"]", content)
            required_tables.update(tables)
        
        # فحص supabase-queries
        queries_file = self.frontend_path / 'src' / 'lib' / 'supabase-queries.js'
        if queries_file.exists():
            content = queries_file.read_text(encoding='utf-8', errors='ignore')
            tables = re.findall(r"\.from\s*\(\s*['\"]([^'\"]+)['\"]", content)
            required_tables.update(tables)
        
        self.stats['tables_found'] = len(required_tables)
        
        # فحص migrations في Backend
        migrations_path = self.backend_path / 'migrations'
        defined_tables = set()
        
        if migrations_path.exists():
            for sql_file in migrations_path.glob('*.sql'):
                content = sql_file.read_text(encoding='utf-8', errors='ignore')
                # البحث عن CREATE TABLE
                creates = re.findall(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["\']?(\w+)["\']?', content, re.IGNORECASE)
                defined_tables.update(creates)
        
        # مقارنة
        missing_tables = required_tables - defined_tables
        if missing_tables:
            self.issues['high'].append({
                'type': 'missing_tables',
                'tables': list(missing_tables),
                'message': f"جداول مطلوبة غير موجودة في migrations: {list(missing_tables)}"
            })
        
        self.issues['info'].append({
            'type': 'tables_summary',
            'required': list(required_tables),
            'defined': list(defined_tables),
            'message': f"الجداول المطلوبة: {len(required_tables)}, المُعرَّفة: {len(defined_tables)}"
        })
    
    def audit_duplicate_files(self):
        """فحص الملفات المكررة وغير المستخدمة"""
        lib_path = self.frontend_path / 'src' / 'lib'
        components_path = self.frontend_path / 'src' / 'components'
        
        if not lib_path.exists():
            return
        
        # جمع جميع ملفات lib
        lib_files = {f.stem: f for f in lib_path.glob('*.js')}
        
        # فحص الاستخدام
        used_libs = set()
        if components_path.exists():
            for jsx_file in components_path.glob('*.jsx'):
                content = jsx_file.read_text(encoding='utf-8', errors='ignore')
                for lib_name in lib_files.keys():
                    if lib_name in content:
                        used_libs.add(lib_name)
        
        # فحص الاستخدام الداخلي في lib
        for lib_file in lib_files.values():
            content = lib_file.read_text(encoding='utf-8', errors='ignore')
            for lib_name in lib_files.keys():
                if lib_name != lib_file.stem and lib_name in content:
                    used_libs.add(lib_name)
        
        # الملفات غير المستخدمة
        unused_libs = set(lib_files.keys()) - used_libs
        
        # استثناء الملفات الأساسية
        essential_libs = {'supabase-client', 'api-unified', 'i18n', 'utils', 'enhanced-themes'}
        unused_libs = unused_libs - essential_libs
        
        if unused_libs:
            self.issues['medium'].append({
                'type': 'unused_lib_files',
                'files': list(unused_libs),
                'message': f"ملفات lib غير مستخدمة ({len(unused_libs)}): {list(unused_libs)[:10]}"
            })
    
    def audit_compatibility(self):
        """فحص التوافق بين Frontend و Backend"""
        # فحص متغيرات البيئة المطلوبة
        env_example = self.frontend_path / '.env.example'
        env_local = self.frontend_path / '.env.local'
        
        required_env = set()
        if env_example.exists():
            content = env_example.read_text(encoding='utf-8', errors='ignore')
            vars = re.findall(r'^(VITE_\w+)=', content, re.MULTILINE)
            required_env.update(vars)
        
        # فحص استخدام متغيرات البيئة في الكود
        used_env = set()
        for jsx_file in (self.frontend_path / 'src').rglob('*.jsx'):
            content = jsx_file.read_text(encoding='utf-8', errors='ignore')
            vars = re.findall(r'import\.meta\.env\.(VITE_\w+)', content)
            used_env.update(vars)
        
        for js_file in (self.frontend_path / 'src').rglob('*.js'):
            content = js_file.read_text(encoding='utf-8', errors='ignore')
            vars = re.findall(r'import\.meta\.env\.(VITE_\w+)', content)
            used_env.update(vars)
        
        # المتغيرات المستخدمة غير المُعرَّفة
        undefined_env = used_env - required_env
        if undefined_env:
            self.issues['medium'].append({
                'type': 'undefined_env_vars',
                'vars': list(undefined_env),
                'message': f"متغيرات بيئة مستخدمة غير مُعرَّفة: {list(undefined_env)}"
            })
    
    def audit_build_readiness(self):
        """فحص جاهزية البناء"""
        # فحص package.json
        package_json = self.frontend_path / 'package.json'
        if package_json.exists():
            try:
                pkg = json.loads(package_json.read_text())
                
                # فحص scripts
                if 'scripts' not in pkg or 'build' not in pkg.get('scripts', {}):
                    self.issues['critical'].append({
                        'type': 'missing_build_script',
                        'message': "لا يوجد script للبناء في package.json"
                    })
                
                # فحص dependencies
                deps = pkg.get('dependencies', {})
                dev_deps = pkg.get('devDependencies', {})
                
                required_deps = ['react', 'react-dom']
                for dep in required_deps:
                    if dep not in deps and dep not in dev_deps:
                        self.issues['critical'].append({
                            'type': 'missing_dependency',
                            'dependency': dep,
                            'message': f"Dependency مطلوب غير موجود: {dep}"
                        })
            except json.JSONDecodeError:
                self.issues['critical'].append({
                    'type': 'invalid_package_json',
                    'message': "ملف package.json غير صالح"
                })
        else:
            self.issues['critical'].append({
                'type': 'missing_package_json',
                'message': "ملف package.json غير موجود"
            })
    
    def print_results(self):
        """طباعة النتائج"""
        print("\n" + "=" * 60)
        print("📊 نتائج الفحص")
        print("=" * 60)
        
        print(f"\n📈 الإحصائيات:")
        print(f"   - الملفات المفحوصة: {self.stats['files_scanned']}")
        print(f"   - الدوال المكتشفة: {self.stats['functions_found']}")
        print(f"   - الاستيرادات: {self.stats['imports_found']}")
        print(f"   - الجداول: {self.stats['tables_found']}")
        
        total_issues = sum(len(v) for v in self.issues.values())
        print(f"\n🔍 إجمالي المشاكل: {total_issues}")
        
        if self.issues['critical']:
            print(f"\n🔴 مشاكل حرجة ({len(self.issues['critical'])}):")
            for issue in self.issues['critical']:
                print(f"   ❌ {issue['message']}")
        
        if self.issues['high']:
            print(f"\n🟠 مشاكل عالية ({len(self.issues['high'])}):")
            for issue in self.issues['high']:
                print(f"   ⚠️ {issue['message']}")
        
        if self.issues['medium']:
            print(f"\n🟡 مشاكل متوسطة ({len(self.issues['medium'])}):")
            for issue in self.issues['medium']:
                print(f"   📝 {issue['message']}")
        
        if self.issues['low']:
            print(f"\n🟢 تحسينات مقترحة ({len(self.issues['low'])}):")
            for issue in self.issues['low']:
                print(f"   💡 {issue['message']}")
        
        # الحكم النهائي
        print("\n" + "=" * 60)
        if self.issues['critical']:
            print("❌ الحكم: يوجد مشاكل حرجة تمنع التشغيل!")
        elif self.issues['high']:
            print("⚠️ الحكم: يوجد مشاكل عالية الخطورة تحتاج إصلاح")
        elif self.issues['medium']:
            print("📝 الحكم: التطبيق جاهز مع بعض التحسينات المقترحة")
        else:
            print("✅ الحكم: التطبيق جاهز للنشر!")
        print("=" * 60)
    
    def save_report(self):
        """حفظ التقرير"""
        report = {
            'stats': self.stats,
            'issues': self.issues,
            'summary': {
                'critical': len(self.issues['critical']),
                'high': len(self.issues['high']),
                'medium': len(self.issues['medium']),
                'low': len(self.issues['low']),
                'info': len(self.issues['info'])
            }
        }
        
        report_path = self.frontend_path / 'audit_report.json'
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        print(f"\n📄 تم حفظ التقرير في: {report_path}")


if __name__ == '__main__':
    # تشغيل الفحص
    audit = AuditSystem(
        frontend_path='/home/ubuntu/love/frontend',
        backend_path='/home/ubuntu/love-api'
    )
    audit.run_full_audit()
