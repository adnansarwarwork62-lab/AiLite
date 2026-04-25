/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, User, Lock, Loader2, AlertCircle, LogOut, CheckCircle2, Clipboard, ExternalLink, Trash2, DownloadCloud } from 'lucide-react';

// API Configuration - Using local proxy to bypass CORS
const API_URL = '/api/login';
const WORKER_URL = 'https://adnansearchai.adnansarwarwork62.workers.dev/';

interface UserData {
  id: string;
  name: string;
  tokens?: string;
  [key: string]: any;
}

export default function App() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linksInput, setLinksInput] = useState('');
  const [clickedLinks, setClickedLinks] = useState<Set<number>>(new Set());

  const processedLinks = useMemo(() => {
    return linksInput
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }, [linksInput]);
  
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);

  const handleDownload = async (link: string, index: number) => {
    if (!user) return;
    
    // Check if enough tokens
    const currentTokens = parseInt(user.tokens || '0', 10);
    if (currentTokens <= 0) {
      setError("Insufficient credits. Please top up your tokens.");
      return;
    }

    if (clickedLinks.has(index)) {
      // Re-downloading a already "paid" link?
      // For now, let's just let them download again without deduction 
      // OR you might want to deduct again. The user said "minus the token first".
      // I will assume each distinct click on a raw link button costs 1 token.
    }

    setDownloadingIndex(index);
    setError(null);

    const nextTokens = currentTokens - 1;

    try {
      // Call the update tokens script
      const response = await fetch(`/api/update-tokens?name=${encodeURIComponent(user.name)}&tokens=${nextTokens}`);
      const text = await response.text();

      if (text === "TOKENS UPDATED") {
        // Update local state
        setUser(prev => prev ? { ...prev, tokens: String(nextTokens) } : null);
        
        // Mark as clicked
        setClickedLinks(prev => new Set(prev).add(index));

        // Transformer logic:
        // @ -> https://image-upload-autohdr-j.s3.amazonaws.com/
        // ! -> /processed/
        let transformedUrl = link;
        if (transformedUrl.includes('@') || transformedUrl.includes('!')) {
          transformedUrl = transformedUrl
            .replace('@', 'https://image-upload-autohdr-j.s3.amazonaws.com/')
            .replace('!', '/processed/');
        }

        // Construct the full URL if it doesn't have a protocol and wasn't transformed by the @ rule
        const originalUrl = transformedUrl.startsWith('http') 
          ? transformedUrl 
          : `https://hdrlite.com/${transformedUrl}`;
          
        const downloadUrl = `${WORKER_URL}?url=${encodeURIComponent(originalUrl)}`;
        
        // Trigger download
        window.open(downloadUrl, '_blank');
      } else {
        setError(`Failed to update tokens: ${text}`);
      }
    } catch (err) {
      setError("Failed to update tokens. Transaction cancelled.");
      console.error(err);
    } finally {
      setDownloadingIndex(null);
    }
  };

  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const handleDownloadAll = async () => {
    if (!user || processedLinks.length === 0) return;

    // Filter out links already clicked to avoid double charging (if that's the desired logic)
    // Or just charge for all of them. Let's assume we charge for all remaining un-clicked links.
    const remainingIndices = processedLinks
      .map((_, i) => i)
      .filter(i => !clickedLinks.has(i));

    if (remainingIndices.length === 0) {
      setError("All links have already been processed.");
      return;
    }

    const currentTokens = parseInt(user.tokens || '0', 10);
    if (currentTokens < remainingIndices.length) {
      setError(`Insufficient credits. You need ${remainingIndices.length} tokens for all items.`);
      return;
    }

    setIsDownloadingAll(true);
    setError(null);

    const nextTokens = currentTokens - remainingIndices.length;

    try {
      const response = await fetch(`/api/update-tokens?name=${encodeURIComponent(user.name)}&tokens=${nextTokens}`);
      const text = await response.text();

      if (text === "TOKENS UPDATED") {
        setUser(prev => prev ? { ...prev, tokens: String(nextTokens) } : null);
        
        const newClicked = new Set(clickedLinks);
        
        remainingIndices.forEach(index => {
          const link = processedLinks[index];
          newClicked.add(index);

          let transformedUrl = link;
          if (transformedUrl.includes('@') || transformedUrl.includes('!')) {
            transformedUrl = transformedUrl
              .replace('@', 'https://image-upload-autohdr-j.s3.amazonaws.com/')
              .replace('!', '/processed/');
          }

          const originalUrl = transformedUrl.startsWith('http') 
            ? transformedUrl 
            : `https://hdrlite.com/${transformedUrl}`;
            
          const downloadUrl = `${WORKER_URL}?url=${encodeURIComponent(originalUrl)}`;
          window.open(downloadUrl, '_blank');
        });

        setClickedLinks(newClicked);
      } else {
        setError(`Failed to update tokens: ${text}`);
      }
    } catch (err) {
      setError("Failed to process batch download.");
      console.error(err);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !password) {
      setError('Please enter both name and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // The PHP script uses GET parameters as per user request
      const response = await fetch(`${API_URL}?name=${encodeURIComponent(name)}&password=${encodeURIComponent(password)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      const text = await response.text();

      // The PHP script returns plain text for common errors
      if (text === "INVALID PASSWORD") {
        setError("The password you entered is incorrect.");
      } else if (text === "USER NOT FOUND") {
        setError("No user was found with that name.");
      } else if (text === "Missing name or password parameter") {
        setError("Authentication failed: Missing parameters.");
      } else {
        try {
          // If it's valid JSON, it's the user record
          const userData = JSON.parse(text);
          setUser(userData);
          // Clear previous data
          setLinksInput('');
          setClickedLinks(new Set());
          setError(null);
        } catch (e) {
          // If it's not JSON and not a known error string
          setError("An unexpected response occurred from the server.");
          console.error("Server response:", text);
        }
      }
    } catch (err) {
      setError("Network error: Could not connect to the authentication server. Please check your internet connection or CORS settings.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setName('');
    setPassword('');
    setLinksInput('');
    setClickedLinks(new Set());
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 font-sans text-[#f8fafc]">
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-[400px]"
          >
            <div className="bg-[#1e293b] rounded-[24px] shadow-2xl border border-white/5 overflow-hidden relative">
              <div className="absolute top-6 right-6 bg-emerald-500/10 text-[#10b981] text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                Secure v2.4
              </div>
              
              <div className="p-12">
                <div className="text-center mb-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#6366f1] to-[#a855f7] rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                    <LogIn className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">AILite</h1>
                  <p className="text-[#94a3b8] text-sm mt-2">Authorized Personnel Only</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.05em] text-[#64748b] ml-1" htmlFor="name">
                      Username / ID
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full px-4 py-3 border border-[#334155] rounded-xl bg-[#0f172a] text-white focus:outline-none focus:border-[#6366f1] focus:ring-4 focus:ring-[#6366f1]/10 transition-all text-[15px]"
                      placeholder="Enter your name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.05em] text-[#64748b] ml-1" htmlFor="password">
                      Access Key
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full px-4 py-3 border border-[#334155] rounded-xl bg-[#0f172a] text-white focus:outline-none focus:border-[#6366f1] focus:ring-4 focus:ring-[#6366f1]/10 transition-all text-[15px]"
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-red-500/10 text-red-400 px-4 py-3 rounded-xl flex items-center gap-3 text-sm border border-red-500/20"
                    >
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white font-semibold py-3.5 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Login'
                    )}
                  </button>
                </form>

                <div className="mt-8 text-center text-[13px] text-[#64748b] flex items-center justify-center gap-3">
                  <a href="#" className="hover:text-[#6366f1] transition-colors">System Status</a>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl"
          >
            <div className="bg-[#1e293b] rounded-[24px] shadow-2xl border border-white/5 overflow-hidden">
              <div className="p-8 text-white relative overflow-hidden bg-gradient-to-br from-[#1e293b] to-[#0f172a]">
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-4 mb-2">
                      <div className="p-2 bg-emerald-500/20 rounded-lg">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight">Access Granted</h2>
                    </div>
                    <p className="text-[#94a3b8]">Verified identity: <span className="text-white font-medium">{user.name}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#64748b]">Session Status</p>
                    <p className="text-emerald-500 font-bold flex items-center gap-2 justify-end">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                      Active
                    </p>
                  </div>
                </div>
                {/* Decorative background circle */}
                <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-[#6366f1] rounded-full opacity-10 blur-3xl"></div>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-[#0f172a] p-5 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-[#64748b] uppercase tracking-widest font-bold mb-2">Remaining Tokens</p>
                    <p className="font-mono text-[#f8fafc] text-lg">{user.tokens ?? user.id ?? '0'}</p>
                  </div>
                  <div className="bg-[#0f172a] p-5 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-[#64748b] uppercase tracking-widest font-bold mb-2">Display Name</p>
                    <p className="font-semibold text-[#f8fafc] text-lg">{user.name}</p>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#64748b] ml-1">
                      Paste Order Links
                    </label>
                    <button 
                      onClick={() => {
                        setLinksInput('');
                        setClickedLinks(new Set());
                      }}
                      className="text-[10px] text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 uppercase tracking-tighter"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear All
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute top-3 left-3 pointer-events-none">
                      <Clipboard className="w-5 h-5 text-[#334155]" />
                    </div>
                    <textarea
                      value={linksInput}
                      onChange={(e) => setLinksInput(e.target.value)}
                      placeholder="Paste your links here (one per line)..."
                      className="w-full h-32 bg-[#0f172a] border border-[#334155] rounded-2xl p-4 pl-11 text-sm text-[#f8fafc] focus:outline-none focus:border-[#6366f1] transition-all resize-none font-mono"
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {processedLinks.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-8"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748b] ml-1">
                          Processed Actions ({processedLinks.length})
                        </h3>
                        <button
                          onClick={handleDownloadAll}
                          disabled={isDownloadingAll || processedLinks.length === 0}
                          className="flex items-center gap-2 px-3 py-1.5 bg-[#6366f1]/10 hover:bg-[#6366f1] text-[#6366f1] hover:text-white rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-[#6366f1]/20 hover:border-[#6366f1]"
                        >
                          {isDownloadingAll ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <DownloadCloud className="w-3 h-3" />
                          )}
                          Download All
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                        {processedLinks.map((link, index) => (
                          <motion.button
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => handleDownload(link, index)}
                            className={`group w-full flex items-center justify-between p-4 rounded-xl transition-all text-left border ${
                              clickedLinks.has(index) 
                                ? 'bg-emerald-500/5 border-emerald-500/30' 
                                : 'bg-[#0f172a] hover:bg-[#6366f1]/10 border-white/5 hover:border-[#6366f1]/30'
                            }`}
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold transition-colors ${
                                downloadingIndex === index
                                  ? 'bg-blue-500 text-white'
                                  : clickedLinks.has(index)
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-[#334155]/50 text-[#64748b] group-hover:bg-[#6366f1] group-hover:text-white'
                              }`}>
                                {downloadingIndex === index ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : clickedLinks.has(index) ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  index + 1
                                )}
                              </div>
                              <span className={`text-xs truncate font-mono transition-colors ${
                                downloadingIndex === index 
                                  ? 'text-blue-400' 
                                  : clickedLinks.has(index) 
                                    ? 'text-emerald-400' 
                                    : 'text-[#94a3b8] group-hover:text-[#f8fafc]'
                              }`}>
                                {link}
                              </span>
                            </div>
                            {downloadingIndex === index ? (
                               <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            ) : (
                              <ExternalLink className={`w-4 h-4 shrink-0 transition-colors ${
                                clickedLinks.has(index) ? 'text-emerald-500' : 'text-[#344155] group-hover:text-[#6366f1]'
                              }`} />
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={handleLogout}
                  className="w-full py-3.5 bg-[#1e293b] border border-[#334155] text-[#f8fafc] font-semibold rounded-xl hover:bg-[#334155] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <LogOut className="w-5 h-5" />
                  Terminate Session
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}
