const DEFAULT_STATIONS = [
  { id: 'lab', name: 'Laboratory', nameAr: 'المختبر', floor: 'الطابق الأول', floorCode: '1', note: '' },
  { id: 'xray', name: 'X-Ray', nameAr: 'الأشعة', floor: 'الطابق الثاني', floorCode: '2', note: '' },
];

export async function getDynamicMedicalPathway() {
  return DEFAULT_STATIONS;
}
