import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Button } from './Button';
import { Input } from './Input';
import { Lock, Unlock, Globe, LogIn, LogOut } from 'lucide-react';
import { t } from '../lib/i18n';
import api from '../lib/api-unified';
import { CountdownTimer } from './CountdownTimer';
import { toast } from 'react-hot-toast';

export function PatientPage({ patientData, onLogout, onCompletion, language, toggleLanguage }) {
  const [stations, setStations] = useState([]);
  const [pinInputs, setPinInputs] = useState({});
  const [loading, setLoading] = useState(false);

  const updateQueueStatus = useCallback(async (clinicId) => {
    try {
      const queueStatus = await api.getQueueStatus(clinicId);
      if (queueStatus.success) {
        const patientInQueue = queueStatus.data.patients.find(p => p.personalId === patientData.personalId);
        const currentlyServing = queueStatus.data.currentlyServing;

        setStations(prev => prev.map(s => {
          if (s.id === clinicId) {
            const isPatientBeingCalled = currentlyServing && currentlyServing.personalId === patientData.personalId;
            return {
              ...s,
              yourNumber: patientInQueue ? patientInQueue.position : (isPatientBeingCalled ? currentlyServing.position : null),
              ahead: patientInQueue ? queueStatus.data.patients.findIndex(p => p.personalId === patientData.personalId) : 0,
              status: isPatientBeingCalled ? 'serving' : s.status,
              isEntered: !!patientInQueue || isPatientBeingCalled,
              enteredAt: isPatientBeingCalled ? new Date().toISOString() : s.enteredAt
            };
          }
          return s;
        }));
      }
    } catch (error) {
      console.error(`Failed to update queue status for clinic ${clinicId}:`, error);
      toast.error(t('failedToUpdateQueue'));
    }
  }, [patientData.personalId, t]);

  useEffect(() => {
    if (patientData.pathway) {
      const initialStations = patientData.pathway.map((station, index) => ({
        ...station,
        status: index === 0 ? 'ready' : 'locked',
        yourNumber: null,
        ahead: 0,
        isEntered: false,
        enteredAt: null,
      }));
      setStations(initialStations);

      if(initialStations.length > 0 && initialStations[0].status === 'ready') {
          updateQueueStatus(initialStations[0].id);
      }
    }
  }, [patientData.pathway, updateQueueStatus]);

  useEffect(() => {
    const allStationsCompleted = stations.length > 0 && stations.every(s => s.status === 'completed');
    if (allStationsCompleted) {
      onCompletion();
    }
  }, [stations, onCompletion]);

  useEffect(() => {
    const eventSource = new EventSource('/api/v1/events/stream');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'EVENTS' && Array.isArray(data.events)) {
        data.events.forEach(eventData => {
          const activeStation = stations.find(s => s.status === 'ready' || s.status === 'serving');
          if (activeStation && activeStation.id === eventData.clinicId) {
            console.log(`Relevant event received for clinic ${eventData.clinicId}: ${eventData.type}`);
            updateQueueStatus(activeStation.id);
          }
        });
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource failed:', err);
    };

    return () => {
      eventSource.close();
    };
  }, [stations, updateQueueStatus]);

  const handleEnterClinic = async (station) => {
    try {
      setLoading(true);
      const pin = pinInputs[station.id] || '';

      const enterResult = await api.enterQueue(patientData.sessionId, station.id, pin);

      if (enterResult.success) {
        toast.success(t('enteredQueueSuccess'));
        await updateQueueStatus(station.id);
      } else {
        toast.error(enterResult.error || t('failedToEnterQueue'));
      }
    } catch (error) {
      toast.error(t('failedToEnterQueue'));
    }
    finally {
      setLoading(false);
    }
  };

  const handleClinicExit = async (station) => {
    try {
      setLoading(true);
      const exitResult = await api.queueDone(patientData.sessionId, station.id);
      if (exitResult.success) {
        toast.success(t('clinicExitSuccess'));
        const currentIdx = stations.findIndex(s => s.id === station.id);
        const nextIdx = currentIdx + 1;

        setStations(prev => {
          const newStations = prev.map((s, i) => {
            if (i === currentIdx) return { ...s, status: 'completed' };
            if (i === nextIdx) return { ...s, status: 'ready' };
            return s;
          });

          if (newStations[nextIdx] && newStations[nextIdx].status === 'ready') {
             updateQueueStatus(newStations[nextIdx].id);
          }
          return newStations;
        });

      } else {
        toast.error(exitResult.error || t('failedToExitClinic'));
      }
    } catch(error) {
      toast.error(t('failedToExitClinic'));
    }
    finally {
      setLoading(false);
    }
  };

  const handleTimeout = (stationId) => {
    console.log(`Patient timed out for clinic: ${stationId}`);
    toast.error(t('timeoutMessage'));
    // Potentially trigger a backend event to move the patient to the end of the queue
  };

  const handlePinInputChange = (stationId, value) => {
      setPinInputs(prev => ({ ...prev, [stationId]: value }));
  }

  const getFloorHint = (floor) => {
    if (floor === 'Mezzanine') return t('mezzanineHint');
    if (floor === '2nd Floor') return t('secondFloorHint');
    if (floor === '3rd Floor') return t('thirdFloorHint');
    return '';
  };

  return (
    <div className="min-h-screen p-4" data-test="patient-page">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="absolute top-4 left-4">
          <Button variant="ghost" size="sm" onClick={toggleLanguage}>
            <Globe className="icon icon-md me-2" />
            {language === 'ar' ? 'English 🇺🇸' : 'العربية 🇶🇦'}
          </Button>
        </div>
        <div className="text-center space-y-4">
          <img src="/logo.jpeg" alt={t('medicalServicesCommand')} className="mx-auto w-24 h-24 rounded-full shadow-lg" />
          <div>
            <h1 className="text-2xl font-bold text-white">{t('medicalServicesCommand')}</h1>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('yourMedicalRoute')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stations.map((station) => (
              <Card key={station.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {station.status === 'locked' ? <Lock /> : <Unlock />}
                      <div>
                        <h3>{station.name}</h3>
                        <p>{getFloorHint(station.floor)}</p>
                      </div>
                    </div>
                    <span>{station.status}</span>
                  </div>

                  {station.isEntered && (
                    <div>
                      <p>{t('yourNumber')}: {station.yourNumber || '-'}</p>
                      <p>{t('ahead')}: {station.ahead || 0}</p>
                    </div>
                  )}

                  {station.status === 'serving' && (
                    <div className="mt-4 space-y-3">
                      <div className="p-4 bg-green-100 text-green-800 rounded-lg">
                        <p className="font-bold text-lg">{t('nowServingMessage')}</p>
                      </div>
                      <CountdownTimer
                        enteredAt={station.enteredAt}
                        maxSeconds={300}
                        onTimeout={() => handleTimeout(station.id)}
                      />
                      <Button onClick={() => handleClinicExit(station)} disabled={loading}>
                        <LogOut className="me-2" /> {t('exitClinic')}
                      </Button>
                    </div>
                  )}

                  {station.status === 'ready' && !station.isEntered && (
                    <div className="mt-4 space-y-3">
                      {station.requires_pin && (
                        <Input
                          type="text"
                          placeholder={t('enterPIN')}
                          value={pinInputs[station.id] || ''}
                          onChange={(e) => handlePinInputChange(station.id, e.target.value)}
                        />
                      )}
                      <Button onClick={() => handleEnterClinic(station)} disabled={loading || (station.requires_pin && !(pinInputs[station.id] || '').trim())}>
                        <LogIn className="me-2" /> {t('enterClinic')}
                      </Button>
                    </div>
                  )}

                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
        <div className="text-center">
          <Button variant="outline" onClick={onLogout}>{t('exitSystem')}</Button>
        </div>
      </div>
    </div>
  );
}
