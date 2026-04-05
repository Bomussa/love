export async function getDynamicMedicalPathway() {
  return [
    { id: 'vitals', name: 'Vitals', nameAr: 'القياسات', floor: 'Ground', floorCode: 'G' },
    { id: 'internal', name: 'Internal Medicine', nameAr: 'الباطنية', floor: 'First', floorCode: '1' },
  ];
}
