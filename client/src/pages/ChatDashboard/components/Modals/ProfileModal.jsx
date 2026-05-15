import { useState } from 'react';
import { X, Camera, Lock, User as UserIcon, Shield, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

export default function ProfileModal({
  user,
  editName,
  setEditName,
  setShowProfileModal,
  profilePicRef,
  handleAvatarUpload,
  handleProfileUpdate // Note: Ensure this parent function passes the new fields if needed, or we handle it here
}) {
  const [activeTab, setActiveTab] = useState('general');
  const [about, setAbout] = useState(user?.about || "");
  const [status, setStatus] = useState(user?.status || "Online");
  
  // Password State
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const statusOptions = ["Online", "Away", "Do Not Disturb", "Debugging", "Surviving Deadlines"];

  const onSaveProfile = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Assuming your parent handleProfileUpdate can be bypassed for this more complex local update,
      // or you can pass these parameters up. For isolation, we call it directly here:
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.put(`${API_URL}/api/users/profile`, { 
        email: user.email, 
        full_name: editName, 
        avatar: user.avatar || '',
        about: about,
        status: status
      });
      
      // Update local storage and close
      const updatedUser = { ...user, ...res.data };
      localStorage.setItem('nexus_user', JSON.stringify(updatedUser));
      window.location.reload(); // Quick refresh to apply states globally across components
    } catch (err) {
      console.error("Failed to update profile", err);
    } finally {
      setIsLoading(false);
    }
  };

  const onSavePassword = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (passwords.new !== passwords.confirm) {
      return setPassError("New passwords do not match.");
    }
    if (passwords.new.length < 6) {
      return setPassError("Password must be at least 6 characters.");
    }

    setIsLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
      // This requires your backend to have a /api/auth/change-password route
      await axios.put(`${API_URL}/api/auth/change-password`, {
        email: user.email,
        currentPassword: passwords.current,
        newPassword: passwords.new
      });
      
      setPassSuccess("Password updated successfully!");
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err) {
      setPassError(err.response?.data?.error || "Failed to update password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-dark-900/80 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-dark-800 rounded-3xl border border-gray-700 w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="relative p-6 border-b border-gray-800 bg-dark-800 shrink-0">
          <button onClick={() => setShowProfileModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white transition"><X className="h-5 w-5"/></button>
          <h2 className="text-xl font-bold text-white text-center">Profile Settings</h2>
          
          {/* Tabs */}
          <div className="flex gap-2 mt-6 bg-dark-900 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('general')} 
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${activeTab === 'general' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <UserIcon className="h-4 w-4" /> General
            </button>
            <button 
              onClick={() => setActiveTab('security')} 
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${activeTab === 'security' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <Shield className="h-4 w-4" /> Security
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          
          {/* GENERAL TAB */}
          {activeTab === 'general' && (
            <form onSubmit={onSaveProfile} className="space-y-6">
              <div className="flex flex-col items-center">
                <div className="relative group cursor-pointer" onClick={() => profilePicRef.current.click()}>
                  {user?.avatar ? (
                    <img src={user.avatar} alt="Avatar" className="h-24 w-24 rounded-full object-cover border-4 border-dark-900 shadow-lg group-hover:opacity-50 transition" />
                  ) : (
                    <div className="h-24 w-24 bg-brand-500 rounded-full flex items-center justify-center text-3xl font-bold shadow-lg group-hover:opacity-50 transition">
                      {user?.full_name?.charAt(0)}
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-full bg-black/40">
                    <Camera className="h-8 w-8 text-white" />
                  </div>
                </div>
                <input type="file" accept="image/*" ref={profilePicRef} onChange={handleAvatarUpload} className="hidden" />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block uppercase tracking-wider font-semibold">Display Name</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-dark-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-colors" />
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block uppercase tracking-wider font-semibold">Current Status</label>
                  <select 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-dark-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-colors appearance-none"
                  >
                    {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">About</label>
                    <span className={`text-xs ${about.length > 150 ? 'text-red-400' : 'text-gray-500'}`}>{about.length}/150</span>
                  </div>
                  <textarea 
                    value={about} 
                    onChange={(e) => setAbout(e.target.value.slice(0, 150))} 
                    rows="3"
                    placeholder="Tell your contacts a little about yourself..."
                    className="w-full bg-dark-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-colors resize-none" 
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowProfileModal(false)} className="flex-1 py-3 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition font-medium">Cancel</button>
                <button type="submit" disabled={isLoading} className="flex-1 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium transition disabled:opacity-50">
                  {isLoading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <form onSubmit={onSavePassword} className="space-y-5">
              
              <div className="bg-dark-900/50 p-4 rounded-xl border border-gray-800 mb-6">
                <div className="flex items-center gap-3 text-brand-400 mb-2">
                  <Lock className="h-5 w-5" />
                  <h3 className="font-semibold text-white">Change Password</h3>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">Ensure your new password is at least 6 characters long and includes a mix of letters and numbers for maximum security.</p>
              </div>

              {passError && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" /> <p>{passError}</p>
                </div>
              )}
              {passSuccess && (
                <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-3 flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle className="h-4 w-4 shrink-0" /> <p>{passSuccess}</p>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-400 mb-1 block font-semibold">Current Password</label>
                <input type="password" required value={passwords.current} onChange={(e) => setPasswords({...passwords, current: e.target.value})} className="w-full bg-dark-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block font-semibold">New Password</label>
                <input type="password" required value={passwords.new} onChange={(e) => setPasswords({...passwords, new: e.target.value})} className="w-full bg-dark-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block font-semibold">Confirm New Password</label>
                <input type="password" required value={passwords.confirm} onChange={(e) => setPasswords({...passwords, confirm: e.target.value})} className="w-full bg-dark-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500" />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={isLoading} className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium transition disabled:opacity-50 shadow-lg shadow-brand-500/20">
                  {isLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}