import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Save, FileText, Clock, Trash2, Eye, Video, VideoOff, User, Maximize, Minimize, Settings, Link, Camera } from 'lucide-react';

const API_URL = `${process.env.REACT_APP_API_URL}/api`;

const PROFANITY_LIST = [
  'kontol', 'memek', 'anjing', 'bangsat', 'babi', 'tolol', 'goblok', 
  'bodoh', 'idiot', 'bajingan', 'asu', 'jancok', 'cok', 'tai', 'taik',
  'pepek', 'peler', 'ngentot', 'entot', 'jembut', 'kimak', 'kampret',
  'monyet', 'brengsek', 'sialan', 'setan', 'iblis', 'fuck', 'shit',
  'damn', 'hell', 'bitch', 'bastard', 'ass', 'dick', 'pussy', 'cock',
  'ngaceng', 'colmek', 'coli', 'bacot', 'bego', 'dungu', 'pantek'
];

const filterProfanity = (text) => {
  if (!text) return text;
  let filteredText = text;
  PROFANITY_LIST.forEach(badWord => {
    const exactRegex = new RegExp(`\\b${badWord}\\b`, 'gi');
    filteredText = filteredText.replace(exactRegex, (match) => '*'.repeat(match.length));
  });
  return filteredText;
};

const notulenAPI = {
  getAll: async () => {
    const response = await fetch(`${API_URL}/notulens`);
    if (!response.ok) throw new Error('Failed to fetch notulens');
    return response.json();
  },

  create: async (notulen) => {
    const response = await fetch(`${API_URL}/notulens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notulen)
    });
    if (!response.ok) throw new Error('Failed to create notulen');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_URL}/notulens/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete notulen');
    return response.json();
  }
};

const ENotulenApp = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [liveSubtitle, setLiveSubtitle] = useState('');
  const [currentSession, setCurrentSession] = useState({
    judulRapat: '',
    pimpinanRapat: '',
    notulensi: '',
    startTime: null,
    text: ''
  });
  const [savedNotulens, setSavedNotulens] = useState([]);
  const [selectedNotulen, setSelectedNotulen] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const [view, setView] = useState('record');
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [recognitionActive, setRecognitionActive] = useState(false);
  
  // New states for source selection
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [videoSource, setVideoSource] = useState('local'); // 'local', 'stream', 'cctv'
  const [streamUrl, setStreamUrl] = useState('');
  const [cctvUrl, setCctvUrl] = useState('');
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  
  const recognitionRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const videoContainerRef = useRef(null);
  const restartTimeoutRef = useRef(null);
  const isRestartingRef = useRef(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

const isMicSilent = () => {
  if (!analyserRef.current) return false;

  const data = new Uint8Array(analyserRef.current.frequencyBinCount);
  analyserRef.current.getByteFrequencyData(data);
  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  return avg < 5; // threshold
};


useEffect(() => {
  const warmUpMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      console.log('Microphone warmed up');
    } catch (e) {
      console.warn('Mic permission not granted yet');
    }
  };

  warmUpMic();
}, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'id-ID';
    recognition.maxAlternatives = 3;

    recognition.onspeechstart = () => {
  setRecognitionActive(true);
};

recognition.onspeechend = () => {
  setRecognitionActive(false);
};


    recognition.onstart = () => {
      console.log('Recognition started');
      setRecognitionActive(true);
      isRestartingRef.current = false;
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPiece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPiece + ' ';
        } else {
          interimTranscript += transcriptPiece;
        }
      }

      const latestText = finalTranscript || interimTranscript;
      if (latestText) {
        const filteredLatestText = filterProfanity(latestText.trim());
        setLiveSubtitle(filteredLatestText);
        
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
        }
        
        restartTimeoutRef.current = setTimeout(() => {
          setLiveSubtitle('');
        }, 5000);
      }

      if (finalTranscript) {
        setCurrentSession(prev => {
          const filteredTranscript = filterProfanity(finalTranscript);
          const newText = prev.text + filteredTranscript;
          return { ...prev, text: newText };
        });
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setRecognitionActive(false);
      
      if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'network') {
        return;
      }
      
      if (isRecording && !isRestartingRef.current) {
        isRestartingRef.current = true;
        setTimeout(() => {
          if (isRecording && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              isRestartingRef.current = false;
            }
          }
        }, 1000);
      }
    };

    recognition.onend = () => {
      console.log('Recognition ended');
      setRecognitionActive(false);
      
      if (isRecording && !isRestartingRef.current) {
        isRestartingRef.current = true;
        setTimeout(() => {
          if (isRecording && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (error) {
              setTimeout(() => {
                if (isRecording && recognitionRef.current) {
                  try {
                    recognitionRef.current.start();
                  } catch (e) {
                    isRestartingRef.current = false;
                  }
                }
              }, 1000);
            }
          } else {
            isRestartingRef.current = false;
          }
        }, 100);
      }
    };

    recognitionRef.current = recognition;
    loadNotulens();
    enumerateDevices();

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
      
    };
  }, [isRecording]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const enumerateDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      
      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);
      
      if (audioInputs.length > 0 && !selectedAudioDevice) {
        setSelectedAudioDevice(audioInputs[0].deviceId);
      }
      if (videoInputs.length > 0 && !selectedVideoDevice) {
        setSelectedVideoDevice(videoInputs[0].deviceId);
      }
    } catch (error) {
      console.error('Error enumerating devices:', error);
    }
  };

  const loadNotulens = async () => {
    try {
      const data = await notulenAPI.getAll();
      setSavedNotulens(data.sort((a, b) => 
        new Date(b.startTime) - new Date(a.startTime)
      ));
    } catch (error) {
      console.error('Error loading notulens:', error);
    }
  };

  const startLocalVideo = async () => {
    try {
      const constraints = {
        video: selectedVideoDevice ? 
          { deviceId: { exact: selectedVideoDevice }, width: { ideal: 1920 }, height: { ideal: 1080 } } :
          { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: selectedAudioDevice ?
          { deviceId: { exact: selectedAudioDevice } } :
          true
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsVideoEnabled(true);
        
        // Setup audio context for speech recognition
        setupAudioContext(stream);
      }
    } catch (error) {
      console.error('Error accessing local media:', error);
      alert('Tidak dapat mengakses kamera/microphone. Pastikan Anda telah memberikan izin.');
    }
  };

  const startStreamVideo = async () => {
    try {
      if (!streamUrl.trim()) {
        alert('Masukkan URL stream terlebih dahulu');
        return;
      }

      if (videoRef.current) {
        videoRef.current.src = streamUrl;
        videoRef.current.crossOrigin = 'anonymous';
        setIsVideoEnabled(true);
        
        // For streaming video, we need audio input separately
        await startAudioOnly();
      }
    } catch (error) {
      console.error('Error loading stream:', error);
      alert('Gagal memuat stream. Pastikan URL valid dan mendukung CORS.');
    }
  };

  const startCCTVVideo = async () => {
    try {
      if (!cctvUrl.trim()) {
        alert('Masukkan URL CCTV terlebih dahulu');
        return;
      }

      if (videoRef.current) {
        // For CCTV, typically we use HLS or RTSP through a proxy
        videoRef.current.src = cctvUrl;
        videoRef.current.crossOrigin = 'anonymous';
        setIsVideoEnabled(true);
        
        // For CCTV video, we need audio input separately
        await startAudioOnly();
      }
    } catch (error) {
      console.error('Error loading CCTV:', error);
      alert('Gagal memuat CCTV. Pastikan URL valid dan dapat diakses.');
    }
  };

  const startAudioOnly = async () => {
    try {
      const constraints = {
        audio: selectedAudioDevice ?
          { deviceId: { exact: selectedAudioDevice } } :
          true
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setupAudioContext(stream);
    } catch (error) {
      console.error('Error accessing audio:', error);
      alert('Tidak dapat mengakses microphone. Speech recognition mungkin tidak bekerja.');
    }
  };

  const setupAudioContext = (stream) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      source.connect(analyser);
      analyser.fftSize = 256;
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
    } catch (error) {
      console.error('Error setting up audio context:', error);
    }
  };

  const startVideo = async () => {
    switch (videoSource) {
      case 'local':
        await startLocalVideo();
        break;
      case 'stream':
        await startStreamVideo();
        break;
      case 'cctv':
        await startCCTVVideo();
        break;
      default:
        await startLocalVideo();
    }
  };

  const stopVideo = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = '';
    }
    

    
    setIsVideoEnabled(false);
  };

  const toggleFullscreen = async () => {
    if (!videoContainerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await videoContainerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };

  const startRecording = async () => {
    if (!recognitionRef.current) return;
    
    if (!isVideoEnabled) {
      await startVideo();

setTimeout(() => {
  try {
    recognitionRef.current.start();
    setIsRecording(true);
  } catch (e) {
    console.error(e);
  }
}, 400);
    }
    
    setCurrentSession(prev => ({
      ...prev,
      startTime: new Date().toISOString(),
      text: prev.startTime ? prev.text : ''
    }));
    setLiveSubtitle('');
    isRestartingRef.current = false;
    
    try {
      recognitionRef.current.start();
      setIsRecording(true);
      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recognition:', error);
      if (error.message && error.message.includes('already started')) {
        setIsRecording(true);
        setRecognitionActive(true);
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log('Error stopping recognition:', e);
      }
    }
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    
    isRestartingRef.current = false;
    setIsRecording(false);
    setRecognitionActive(false);
    setLiveSubtitle('');
  };

  const saveNotulen = async () => {
    if (!currentSession.text.trim()) {
      alert('Tidak ada teks untuk disimpan! Silakan rekam audio terlebih dahulu.');
      return;
    }

    if (!currentSession.judulRapat.trim()) {
      alert('Judul Rapat harus diisi!');
      return;
    }

    const notulen = {
      id: Date.now().toString(),
      judulRapat: currentSession.judulRapat,
      pimpinanRapat: currentSession.pimpinanRapat,
      notulensi: currentSession.notulensi,
      startTime: currentSession.startTime,
      endTime: new Date().toISOString(),
      text: currentSession.text,
      duration: Math.floor((new Date() - new Date(currentSession.startTime)) / 1000)
    };

    try {
      await notulenAPI.create(notulen);
      await loadNotulens();
      
      alert(`Notulen berhasil disimpan!\n\nJudul: ${notulen.judulRapat}\nKata: ${notulen.text.split(/\s+/).filter(Boolean).length}\nDurasi: ${Math.floor(notulen.duration / 60)} menit`);
      
      setCurrentSession({ 
        judulRapat: '',
        pimpinanRapat: '',
        notulensi: '',
        startTime: null,
        text: '' 
      });
      
    } catch (error) {
      console.error('Error menyimpan:', error);
      alert('Gagal menyimpan notulen! ' + error.message);
    }
  };

  const deleteNotulen = async (id) => {
    const confirmed = window.confirm('Yakin ingin menghapus notulen ini? Data akan dihapus permanen!');
    
    if (!confirmed) return;
    
    try {
      await notulenAPI.delete(id);
      await loadNotulens();
      
      if (selectedNotulen?.id === id) {
        setSelectedNotulen(null);
      }
      
      alert('Notulen berhasil dihapus!');
      
    } catch (error) {
      console.error('Error menghapus:', error);
      alert('Gagal menghapus notulen! ' + error.message);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Browser Tidak Didukung</h2>
          <p className="text-gray-600">
            Browser Anda tidak mendukung Web Speech API. Silakan gunakan Google Chrome atau Microsoft Edge.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">📝 E-Notulen Live Streaming</h1>
          <p className="text-gray-600">Sistem Notulen Real-time dengan Video CCTV/Stream Support</p>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setView('record')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition ${
              view === 'record'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Mic size={20} />
            Rekam Notulen
          </button>
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition ${
              view === 'list'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FileText size={20} />
            Daftar Notulen ({savedNotulens.length})
          </button>
        </div>

        {view === 'record' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">🎥 Live Streaming</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSourceModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition bg-purple-600 hover:bg-purple-700 text-white"
                    disabled={isRecording}
                  >
                    <Settings size={18} />
                    Sumber Video/Audio
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition bg-gray-600 hover:bg-gray-700 text-white"
                    title="Toggle Fullscreen"
                  >
                    {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                  </button>
                  <button
                    onClick={isVideoEnabled ? stopVideo : startVideo}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
                      isVideoEnabled
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {isVideoEnabled ? <VideoOff size={18} /> : <Video size={18} />}
                    {isVideoEnabled ? 'Matikan Video' : 'Aktifkan Video'}
                  </button>
                </div>
              </div>
              
              <div 
                ref={videoContainerRef}
                className="relative bg-black rounded-lg overflow-hidden aspect-video"
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                
                {isRecording && liveSubtitle && liveSubtitle.trim().length > 0 && (
                  <div className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ${
                    isFullscreen ? 'p-6 sm:p-8 md:p-10' : 'p-4 sm:p-6'
                  }`}>
                    <div className="bg-black/25 backdrop-blur-md shadow-2xl rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 border border-white/30">
                      <div className="flex items-center gap-2 mb-2 sm:mb-3">
                        <div className={`${
                          isFullscreen ? 'w-3 h-3 sm:w-4 sm:h-4' : 'w-2.5 h-2.5 sm:w-3 sm:h-3'
                        } bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50`}></div>
                        <span className={`text-red-400 font-bold tracking-wider uppercase ${
                          isFullscreen ? 'text-xs sm:text-sm md:text-base' : 'text-xs'
                        }`}>
                          Live Subtitle
                        </span>
                      </div>
                      <p className={`text-white font-semibold leading-relaxed line-clamp-3 transition-all duration-300 ${
                        isFullscreen 
                          ? 'text-xl sm:text-2xl md:text-3xl lg:text-4xl' 
                          : 'text-xl sm:text-xl md:text-xl'
                      }`} style={{
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                      }}>
                        {liveSubtitle.slice(-200)}
                      </p>
                    </div>
                  </div>
                )}
                
                {!isVideoEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Video size={64} className="mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Klik "Aktifkan Video" untuk memulai</p>
                      <p className="text-sm text-gray-400 mt-2">Sumber: {videoSource === 'local' ? 'Kamera Lokal' : videoSource === 'stream' ? 'URL Stream' : 'CCTV'}</p>
                    </div>
                  </div>
                )}

                {isFullscreen && (
                  <button
                    onClick={toggleFullscreen}
                    className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-3 rounded-lg transition"
                  >
                    <Minimize size={24} />
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📋 Informasi Rapat</h2>
              
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Judul Rapat <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={currentSession.judulRapat}
                    onChange={(e) => setCurrentSession(s => ({ ...s, judulRapat: e.target.value }))}
                    placeholder="Contoh: Rapat Evaluasi Kinerja Q4"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isRecording}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <User size={16} className="inline mr-1" />
                    Pimpinan Rapat
                  </label>
                  <input
                    type="text"
                    value={currentSession.pimpinanRapat}
                    onChange={(e) => setCurrentSession(s => ({ ...s, pimpinanRapat: e.target.value }))}
                    placeholder="Contoh: Dr. Ahmad Hidayat"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isRecording}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <User size={16} className="inline mr-1" />
                    Notulensi
                  </label>
                  <input
                    type="text"
                    value={currentSession.notulensi}
                    onChange={(e) => setCurrentSession(s => ({ ...s, notulensi: e.target.value }))}
                    placeholder="Contoh: Siti Nurhaliza"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isRecording}
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg transition shadow-lg"
                  >
                    <Mic size={24} />
                    Mulai Rekam
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg transition shadow-lg animate-pulse"
                  >
                    <MicOff size={24} />
                    Stop Rekam
                  </button>
                )}

                <button
                  onClick={saveNotulen}
                  disabled={!currentSession.text.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg transition shadow-lg"
                >
                  <Save size={24} />
                  Simpan Notulen
                </button>
              </div>

              {isRecording && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                      <span className="text-red-600 font-semibold">Sedang merekam</span>
                    </div>
                    <div className="h-4 w-px bg-red-300"></div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${recognitionActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span className="text-sm text-gray-600">
                        {recognitionActive ? 'Speech API Aktif' : 'Speech API Menunggu...'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Subtitle akan muncul di video saat Anda berbicara.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📄 Transkrip Lengkap</h2>
              <div className="bg-gray-50 rounded-lg p-4 min-h-[300px] max-h-[500px] overflow-y-auto border border-gray-200">
                {currentSession.text ? (
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {currentSession.text}
                  </p>
                ) : (
                  <p className="text-gray-400 italic">
                    Teks lengkap akan muncul di sini saat Anda mulai berbicara...
                  </p>
                )}
              </div>
              <div className="mt-2 text-sm text-gray-600">
                Jumlah kata: {currentSession.text.split(/\s+/).filter(Boolean).length}
              </div>
            </div>
          </div>
        )}

        {view === 'list' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📋 Notulen Tersimpan</h2>
              {savedNotulens.length === 0 ? (
                <p className="text-gray-400 italic text-center py-8">
                  Belum ada notulen tersimpan
                </p>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {savedNotulens.map((notulen) => (
                    <div
                      key={notulen.id}
                      className={`border rounded-lg p-4 cursor-pointer transition ${
                        selectedNotulen?.id === notulen.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedNotulen(notulen)}
                    >
                      <h3 className="font-semibold text-gray-800 mb-2">{notulen.judulRapat}</h3>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          {new Date(notulen.startTime).toLocaleString('id-ID')}
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNotulen(notulen);
                          }}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                        >
                          <Eye size={14} />
                          Lihat
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotulen(notulen.id);
                          }}
                          className="flex items-center gap-1 text-red-600 hover:text-red-800 text-sm"
                        >
                          <Trash2 size={14} />
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📝 Detail Notulen</h2>
              {selectedNotulen ? (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    {selectedNotulen.judulRapat}
                  </h3>
                  
                  <div className="bg-blue-50 rounded-lg p-4 mb-4 space-y-2 text-sm">
                    {selectedNotulen.pimpinanRapat && (
                      <div className="flex items-start gap-2">
                        <User size={16} className="mt-0.5 text-blue-600" />
                        <div>
                          <span className="font-semibold">Pimpinan Rapat:</span> {selectedNotulen.pimpinanRapat}
                        </div>
                      </div>
                    )}
                    {selectedNotulen.notulensi && (
                      <div className="flex items-start gap-2">
                        <User size={16} className="mt-0.5 text-blue-600" />
                        <div>
                          <span className="font-semibold">Notulensi:</span> {selectedNotulen.notulensi}
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <Clock size={16} className="mt-0.5 text-blue-600" />
                      <div>
                        <span className="font-semibold">Waktu Mulai:</span> {new Date(selectedNotulen.startTime).toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock size={16} className="mt-0.5 text-blue-600" />
                      <div>
                        <span className="font-semibold">Durasi:</span> {formatDuration(selectedNotulen.duration)}
                      </div>
                    </div>
                  </div>

                  <h4 className="font-semibold text-gray-700 mb-2">Isi Notulen:</h4>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-[400px] overflow-y-auto border border-gray-200">
                    <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {selectedNotulen.text}
                    </p>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    Jumlah kata: {selectedNotulen.text.split(/\s+/).filter(Boolean).length}
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 italic text-center py-8">
                  Pilih notulen untuk melihat detail
                </p>
              )}
            </div>
          </div>
        )}

        {/* Source Selection Modal */}
        {showSourceModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800">⚙️ Pengaturan Sumber Video & Audio</h2>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Pilih Sumber Video
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                      <input
                        type="radio"
                        name="videoSource"
                        value="local"
                        checked={videoSource === 'local'}
                        onChange={(e) => setVideoSource(e.target.value)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <Camera size={20} className="text-gray-600" />
                      <div>
                        <div className="font-semibold">Kamera Lokal</div>
                        <div className="text-sm text-gray-600">Gunakan webcam atau kamera USB</div>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                      <input
                        type="radio"
                        name="videoSource"
                        value="stream"
                        checked={videoSource === 'stream'}
                        onChange={(e) => setVideoSource(e.target.value)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <Link size={20} className="text-gray-600" />
                      <div>
                        <div className="font-semibold">URL Streaming</div>
                        <div className="text-sm text-gray-600">HLS/DASH streaming URL</div>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                      <input
                        type="radio"
                        name="videoSource"
                        value="cctv"
                        checked={videoSource === 'cctv'}
                        onChange={(e) => setVideoSource(e.target.value)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <Video size={20} className="text-gray-600" />
                      <div>
                        <div className="font-semibold">CCTV/IP Camera</div>
                        <div className="text-sm text-gray-600">RTSP/HTTP stream dari CCTV</div>
                      </div>
                    </label>
                  </div>
                </div>

                {videoSource === 'local' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Pilih Kamera
                      </label>
                      <select
                        value={selectedVideoDevice}
                        onChange={(e) => setSelectedVideoDevice(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {videoDevices.map(device => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Kamera ${device.deviceId.slice(0, 8)}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Pilih Microphone
                      </label>
                      <select
                        value={selectedAudioDevice}
                        onChange={(e) => setSelectedAudioDevice(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {audioDevices.map(device => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {videoSource === 'stream' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      URL Streaming <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={streamUrl}
                      onChange={(e) => setStreamUrl(e.target.value)}
                      placeholder="https://example.com/stream.m3u8"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-2"
                    />
                    <p className="text-sm text-gray-600">
                      Contoh format: HLS (.m3u8), DASH (.mpd), atau HTTP video stream
                    </p>
                    
                    <div className="mt-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Pilih Microphone untuk Audio
                      </label>
                      <select
                        value={selectedAudioDevice}
                        onChange={(e) => setSelectedAudioDevice(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {audioDevices.map(device => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {videoSource === 'cctv' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      URL CCTV/IP Camera <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={cctvUrl}
                      onChange={(e) => setCctvUrl(e.target.value)}
                      placeholder="http://192.168.1.100:8080/video"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-2"
                    />
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-800 font-semibold mb-1">⚠️ Catatan Penting:</p>
                      <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                        <li>RTSP tidak didukung langsung di browser. Gunakan proxy HTTP/HLS</li>
                        <li>Contoh: <code className="bg-yellow-100 px-1 rounded">http://ip:port/video</code></li>
                        <li>Pastikan CCTV mendukung HTTP streaming atau gunakan converter RTSP-to-HLS</li>
                      </ul>
                    </div>
                    
                    <div className="mt-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Pilih Microphone untuk Audio
                      </label>
                      <select
                        value={selectedAudioDevice}
                        onChange={(e) => setSelectedAudioDevice(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {audioDevices.map(device => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setShowSourceModal(false)}
                  className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    setShowSourceModal(false);
                    if (isVideoEnabled) {
                      stopVideo();
                    }
                  }}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                >
                  Simpan Pengaturan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ENotulenApp;