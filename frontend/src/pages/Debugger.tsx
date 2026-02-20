import React from "react";
import { useParams } from "react-router-dom";

export default function Debugger() {
  const { contractName } = useParams<{ contractName?: string }>();

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-6xl mx-auto w-full">
      <div className="w-full mb-12 flex items-end justify-between border-b border-hi pb-8">
        <div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">System <span className="text-accent2">Debugger</span></h1>
          <p className="text-muted font-mono text-sm tracking-wider uppercase">On-chain interaction terminal</p>
        </div>
        <div className="flex gap-4">
          <div className="px-4 py-2 glass border-hi rounded-lg text-xs font-mono text-accent uppercase tracking-widest">
            Network: Testnet
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
        {/* Sidebar: Contract List Simulation */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card glass noise h-full">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted mb-6">Contract Registry</h3>
            <div className="space-y-2">
              {['PayrollManager', 'EmployeeStorage', 'TokenFaucet'].map(name => (
                <div 
                  key={name}
                  className={`p-4 rounded-xl border ${contractName === name ? 'border-accent2 bg-accent2/5' : 'border-hi hover:border-text/20'} cursor-pointer transition-all group`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`font-mono text-sm ${contractName === name ? 'text-accent2' : 'text-text'}`}>{name}</span>
                    <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_var(--success)]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Terminal Area */}
        <div className="lg:col-span-2">
          <div className="card glass noise bg-black/40 h-full min-h-[500px] flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-6 border-b border-hi pb-4">
              <div className="w-3 h-3 rounded-full bg-danger/40" />
              <div className="w-3 h-3 rounded-full bg-accent/40" />
              <div className="w-3 h-3 rounded-full bg-accent2/40" />
              <span className="ml-2 font-mono text-xs text-muted">TERMINAL.instance_01</span>
            </div>

            <div className="flex-1 font-mono text-sm space-y-4 overflow-y-auto">
              <div className="text-accent">Welcome to PayD Debugger v1.0.0</div>
              <div className="text-text/60">Connection established to Soroban RPC...</div>
              
              {contractName ? (
                <>
                  <div className="flex gap-2">
                    <span className="text-accent2">➜</span>
                    <span className="text-text">inspect {contractName}</span>
                  </div>
                  <div className="pl-4 text-muted">
                    Loading symbols for {contractName}... <br/>
                    Found 4 exported functions. <br/>
                    Ready for invocation.
                  </div>
                  
                  <div className="mt-8 grid grid-cols-2 gap-4">
                    {['init', 'upgrade', 'get_state', 'execute'].map(fn => (
                      <button key={fn} className="p-3 border border-hi rounded-lg bg-surface hover:bg-surface-hi text-left transition-colors">
                        <span className="text-accent2">fn</span> <span className="text-text">{fn}()</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-30 text-center py-20">
                  <div className="text-4xl mb-4">⌨️</div>
                  <div>Select a contract from the registry to begin debugging</div>
                </div>
              )}
            </div>
            
            <div className="mt-auto pt-6 border-t border-hi">
              <div className="flex items-center gap-3 bg-black/40 p-3 rounded-lg border border-hi">
                <span className="text-accent2 font-bold animate-pulse">_</span>
                <input 
                  type="text" 
                  placeholder="Type command..." 
                  className="bg-transparent border-none outline-none flex-1 text-sm font-mono text-text placeholder:text-muted"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
