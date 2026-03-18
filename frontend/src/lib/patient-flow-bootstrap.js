import baseApi from './api-unified';
import wrappedApi from './patient-flow-api';

const originalGetQueuePosition = baseApi.getQueuePosition?.bind(baseApi);
const originalUpdateQueueStatus = baseApi.updateQueueStatus?.bind(baseApi);
const originalQueueDone = baseApi.queueDone?.bind(baseApi);
const originalPostponePatient = baseApi.postponePatient?.bind(baseApi);
const originalPostponeAndCallNext = baseApi.postponeAndCallNext?.bind(baseApi);
const originalExtendTime = baseApi.extendTime?.bind(baseApi);
const originalCreateSession = baseApi.createSession?.bind(baseApi);
const originalGetRoute = baseApi.getRoute?.bind(baseApi);
const originalCreateRoute = baseApi.createRoute?.bind(baseApi);

function normalizePatientId(value) {
  return String(value ?? '').trim();
}

baseApi.patientLogin = wrappedApi.patientLogin;
baseApi.enterQueue = wrappedApi.enterQueue;
baseApi.generatePIN = wrappedApi.generatePIN;
baseApi.issuePin = wrappedApi.issuePin;

baseApi.getQueuePosition = async (clinicId, patientId) => originalGetQueuePosition(clinicId, normalizePatientId(patientId));
baseApi.updateQueueStatus = async (clinicId, patientId, newStatus) => originalUpdateQueueStatus(clinicId, normalizePatientId(patientId), newStatus);
baseApi.queueDone = async (clinicId, patientId, pin, skipPinCheck = false) => originalQueueDone(clinicId, normalizePatientId(patientId), pin, skipPinCheck);
baseApi.postponePatient = async (clinicId, patientId, reason = 'تأخر عن الحضور', maxPostpones = 3) => originalPostponePatient(clinicId, normalizePatientId(patientId), reason, maxPostpones);
baseApi.postponeAndCallNext = async (clinicId, patientId, pin, reason = 'تأخر عن الحضور', maxPostpones = 3) => originalPostponeAndCallNext(clinicId, normalizePatientId(patientId), pin, reason, maxPostpones);
baseApi.extendTime = async (patientId, minutes) => originalExtendTime(normalizePatientId(patientId), minutes);
baseApi.createSession = async (patientId) => originalCreateSession(normalizePatientId(patientId));
baseApi.getRoute = async (patientId) => originalGetRoute(normalizePatientId(patientId));
baseApi.createRoute = async (patientId, examType, gender, stations) => originalCreateRoute(normalizePatientId(patientId), examType, gender, stations);
