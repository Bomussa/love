/**
 * Initialize Clinics Configuration in KV_ADMIN
 * Run once to set up clinic list
 * 
 * Usage: node scripts/init-clinics.js
 */

const clinicsConfig = {
  "version": "v1",
  "timezone": "Asia/Qatar",
  "clinics": [
    {
      "name": "المختبر",
      "floor": "ميزانين",
      "category": "فحوصات",
      "gender": "مختلط",
      "weight_base": 1.0,
      "capacity": 2,
      "avg_service_seconds": 480,
      "is_active": true
    },
    {
      "name": "الأشعة",
      "floor": "ميزانين",
      "category": "فحوصات",
      "gender": "مختلط",
      "weight_base": 1.0,
      "capacity": 2,
      "avg_service_seconds": 540,
      "is_active": true
    },
    {
      "name": "عيادة العيون",
      "floor": "الطابق الثاني",
      "category": "عيادات",
      "gender": "مختلط",
      "weight_base": 1.0,
      "capacity": 1,
      "avg_service_seconds": 600,
      "is_active": true
    },
    {
      "name": "عيادة الباطنية",
      "floor": "الطابق الثاني",
      "category": "عيادات",
      "gender": "مختلط",
      "weight_base": 1.0,
      "capacity": 1,
      "avg_service_seconds": 600,
      "is_active": true
    },
    {
      "name": "عيادة الأنف والأذن والحنجرة",
      "floor": "الطابق الثاني",
      "category": "عيادات",
      "gender": "مختلط",
      "weight_base": 1.0,
      "capacity": 1,
      "avg_service_seconds": 600,
      "is_active": true
    },
    {
      "name": "عيادة الجراحة العامة",
      "floor": "الطابق الثاني",
      "category": "عيادات",
      "gender": "مختلط",
      "weight_base": 1.0,
      "capacity": 1,
      "avg_service_seconds": 600,
      "is_active": true
    },
    {
      "name": "عيادة الأسنان",
      "floor": "الطابق الثاني",
      "category": "عيادات",
      "gender": "مختلط",
      "weight_base": 1.0,
      "capacity": 1,
      "avg_service_seconds": 720,
      "is_active": true
    },
    {
      "name": "عيادة النفسية",
      "floor": "الطابق الثاني",
      "category": "عيادات",
      "gender": "مختلط",
      "weight_base": 0.9,
      "capacity": 1,
      "avg_service_seconds": 900,
      "is_active": true
    },
    {
      "name": "عيادة الجلدية",
      "floor": "الطابق الثاني",
      "category": "عيادات",
      "gender": "مختلط",
      "weight_base": 1.0,
      "capacity": 1,
      "avg_service_seconds": 540,
      "is_active": true
    },
    {
      "name": "عيادة العظام والمفاصل",
      "floor": "الطابق الثاني",
      "category": "عيادات",
      "gender": "مختلط",
      "weight_base": 1.0,
      "capacity": 1,
      "avg_service_seconds": 720,
      "is_active": true
    },
    {
      "name": "غرفة القياسات الحيوية",
      "floor": "الطابق الثاني",
      "category": "محطات",
      "gender": "مختلط",
      "weight_base": 1.2,
      "capacity": 2,
      "avg_service_seconds": 300,
      "is_active": true
    },
    {
      "name": "غرفة تخطيط القلب",
      "floor": "الطابق الثاني",
      "category": "محطات",
      "gender": "مختلط",
      "weight_base": 1.0,
      "capacity": 1,
      "avg_service_seconds": 480,
      "is_active": true
    },
    {
      "name": "غرفة قياس السمع",
      "floor": "الطابق الثاني",
      "category": "محطات",
      "gender": "مختلط",
      "weight_base": 1.0,
      "capacity": 1,
      "avg_service_seconds": 540,
      "is_active": true
    },
    {
      "name": "عيادة الباطنية (نساء)",
      "floor": "الطابق الثالث",
      "category": "عيادات",
      "gender": "نساء",
      "weight_base": 1.0,
      "capacity": 1,
      "avg_service_seconds": 600,
      "is_active": true
    },
    {
      "name": "عيادة الجلدية (نساء)",
      "floor": "الطابق الثالث",
      "category": "عيادات",
      "gender": "نساء",
      "weight_base": 1.0,
      "capacity": 1,
      "avg_service_seconds": 540,
      "is_active": true
    },
    {
      "name": "عيادة العيون (نساء)",
      "floor": "الطابق الثالث",
      "category": "عيادات",
      "gender": "نساء",
      "weight_base": 1.0,
      "capacity": 1,
      "avg_service_seconds": 600,
      "is_active": true
    }
  ],
  "allow_add_new": true
};

console.log('Clinics Configuration:');
console.log(JSON.stringify(clinicsConfig, null, 2));
console.log('\n✅ Ready to upload to KV_ADMIN with key: clinics:config');

