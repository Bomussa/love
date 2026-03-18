import baseApi from './api-unified';
import wrappedApi from './patient-flow-api';

baseApi.patientLogin = wrappedApi.patientLogin;
baseApi.enterQueue = wrappedApi.enterQueue;
baseApi.generatePIN = wrappedApi.generatePIN;
baseApi.issuePin = wrappedApi.issuePin;
baseApi.getQueuePosition = wrappedApi.getQueuePosition;
baseApi.updateQueueStatus = wrappedApi.updateQueueStatus;
baseApi.queueDone = wrappedApi.queueDone;
baseApi.postponePatient = wrappedApi.postponePatient;
baseApi.postponeAndCallNext = wrappedApi.postponeAndCallNext;
baseApi.extendTime = wrappedApi.extendTime;
baseApi.createSession = wrappedApi.createSession;
baseApi.getRoute = wrappedApi.getRoute;
baseApi.createRoute = wrappedApi.createRoute;
