import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Button } from './Button';
import { Input } from './Input';
import { Lock, Unlock, Clock, Globe, LogIn, LogOut } from 'lucide-react';
import { t } from '../lib/i18n';
import api from '../lib/api-unified';
import { CountdownTimer } from './CountdownTimer';

export function PatientPage({ patientData, onLogout, onCompletion, language, toggleLanguage }) {
  const [stations, setStations] = useState([]);
  const [pinInput, setPinInput] = useState('');
  const [loading, setLoading] = useState(false);

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
    }
  }, [patientData.pathway]);

  useEffect(() => {
    const allStationsCompleted = stations.length > 0 && stations.every(s => s.status === 'completed');
    if (allStationsCompleted) {
      onCompletion();
    }
  }, [stations, onCompletion]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const readyStation = stations.find(s => s.status === 'ready');
      if (readyStation) {
        const queueStatus = await api.getQueueStatus(readyStation.id);
        if (queueStatus.success) {
          const patientInQueue = queueStatus.data.patients.find(p => p.personalId === patientData.personalId);
          setStations(prev => prev.map(s => {
            if (s.id === readyStation.id) {
              return {
                ...s,
                yourNumber: patientInQueue ? patientInQueue.position : null,
                ahead: patientInQueue ? queueStatus.data.patients.indexOf(patientInQueue) : 0,
              };
            }
            return s;
          }));
        }
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [stations, patientData.personalId]);

  const handleEnterClinic = async (station) => {
    try {
      setLoading(true);
      const enterResult = await api.enterQueue(patientData.sessionId, station.id);
      if (enterResult.success) {
        setStations(prev => prev.map(s => s.id === station.id ? { ...s, isEntered: true, enteredAt: new Date().toISOString() } : s));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClinicExit = async (station) => {
    try {
      setLoading(true);
      if (station.requires_pin && !pinInput.trim()) {
        // Handle error: PIN is required
        return;
      }

      const exitResult = await api.queueDone(patientData.sessionId, station.id, station.requires_pin ? pinInput : null);
      if (exitResult.success) {
        const currentIdx = stations.findIndex(s => s.id === station.id);
        const nextIdx = currentIdx + 1;
        setStations(prev => prev.map((s, i) => {
          if (i === currentIdx) return { ...s, status: 'completed' };
          if (i === nextIdx) return { ...s, status: 'ready' };
          return s;
        }));
        setPinInput('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTimeout = (stationId) => {
    console.log(`Patient timed out for clinic: ${stationId}`);
    // Here you could trigger a backend event to move the patient to the end of the queue
  };

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
                      {station.status === 'ready' ? <Unlock /> : <Lock />}
                      <div>
                        <h3>{station.name}</h3>
                        <p>{getFloorHint(station.floor)}</p>
                      </div>
                    </div>
                    <span>{station.status}</span>
                  </div>
                  <div>
                    <p>{t('yourNumber')}: {station.yourNumber || '-'}</p>
                    <p>{t('ahead')}: {station.ahead || 0}</p>
                  </div>
                  {station.status === 'ready' && !station.isEntered && (
                    <Button onClick={() => handleEnterClinic(station)} disabled={loading}>
                      <LogIn className="me-2" /> {t('enterClinic')}
                    </Button>
                  )}
                  {station.status === 'ready' && station.isEntered && (
                    <div className="mt-4 space-y-3">
                      <CountdownTimer
                        enteredAt={station.enteredAt}
                        maxSeconds={300}
                        onTimeout={() => handleTimeout(station.id)}
                      />
                      {station.requires_pin && (
                        <Input
                          type="text"
                          placeholder={t('enterPIN')}
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value)}
                        />
                      )}
                      <Button onClick={() => handleClinicExit(station)} disabled={loading || (station.requires_pin && !pinInput.trim())}>
                        <LogOut className="me-2" /> {t('exitClinic')}
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
