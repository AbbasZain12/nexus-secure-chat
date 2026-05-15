import { useEffect, useRef } from 'react';
import { Phone, PhoneOff, User as UserIcon } from 'lucide-react';

export default function CallOverlay({
  callStatus,
  incomingCallData,
  endCallLocal,
  acceptCall,
  localStream,
  remoteStream,
  endCallNetwork
}) {
  // Define the missing refs here!
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Attach the audio/video streams to the HTML video tags
  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [localStream, remoteStream, callStatus]);

  if (callStatus === 'idle') return null;

  if (callStatus === 'receiving') {
    return (
      <div className="absolute inset-0 bg-dark-900/90 z-50 flex items-center justify-center backdrop-blur-sm">
        <div className="bg-dark-800 p-8 rounded-2xl border border-gray-700 text-center flex flex-col items-center max-w-sm w-full shadow-2xl">
          <div className="h-20 w-20 bg-brand-500/20 rounded-full flex items-center justify-center mb-4 animate-pulse">
            <Phone className="h-10 w-10 text-brand-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{incomingCallData?.from}</h2>
          <div className="flex gap-4 w-full">
            <button onClick={endCallLocal} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-medium transition">Decline</button>
            <button onClick={acceptCall} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-medium transition flex items-center justify-center gap-2">Accept</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black z-50 flex flex-col">
      <div className="flex-1 relative bg-dark-900 flex items-center justify-center">
        {callStatus === 'calling' ? (
          <div className="text-center">
            <div className="h-24 w-24 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <UserIcon className="h-12 w-12 text-gray-500" />
            </div>
            <h2 className="text-2xl font-bold text-white">Calling...</h2>
          </div>
        ) : (
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        )}
        <div className={`absolute bottom-24 right-6 w-32 h-48 md:w-48 md:h-64 bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700 z-10 ${!localStream?.getVideoTracks().length ? 'hidden' : ''}`}>
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
        </div>
      </div>
      <div className="h-20 bg-dark-900 border-t border-gray-800 flex items-center justify-center gap-6 pb-safe">
        <button onClick={endCallNetwork} className="bg-red-500 hover:bg-red-600 p-4 rounded-full shadow-lg transition transform hover:scale-105">
          <PhoneOff className="h-6 w-6 text-white" />
        </button>
      </div>
    </div>
  );
}