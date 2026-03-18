import baseApi from './api-unified';
import wrappedApi from './patient-flow-api';

baseApi.patientLogin = wrappedApi.patientLogin;
baseApi.enterQueue = wrappedApi.enterQueue;
baseApi.generatePIN = wrappedApi.generatePIN;
baseApi.issuePin = wrappedApi.issuePin;
