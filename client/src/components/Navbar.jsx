import { FiZap, FiLogOut, FiUser } from 'react-icons/fi';

export default function Navbar({ user, onLogout }) {
  return (
    <nav id="main-navbar" className="sticky top-0 z-50 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 shadow-md shadow-brand-500/20">
              <FiZap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">PCB Tracker</h1>
              <p className="text-[11px] text-surface-500 leading-none -mt-0.5">Electrolyte Inventory</p>
            </div>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-surface-800/60 rounded-lg border border-surface-700/50">
              <FiUser className="w-3.5 h-3.5 text-brand-400" />
              <span className="text-sm text-surface-300 font-medium">{user?.username}</span>
            </div>
            <button
              id="logout-btn"
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-all duration-200 cursor-pointer"
            >
              <FiLogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
