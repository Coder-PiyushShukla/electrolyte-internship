import { FiZap, FiLogOut, FiUser, FiShield } from 'react-icons/fi';
import { NavLink } from 'react-router-dom';
import NotificationBell from './NotificationBell';

export default function Navbar({ user, onLogout }) {
  const linkBase = "px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200";
  const linkActive = "text-white bg-surface-800";
  const linkInactive = "text-surface-400 hover:text-white hover:bg-surface-800/60";

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

          {/* Page Navigation */}
          <div id="page-nav-links" className="hidden md:flex items-center gap-1">
            <NavLink
              to="/"
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
            >
              Main
            </NavLink>
            <NavLink
              to="/inward"
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
            >
              Inward
            </NavLink>
            <NavLink
              to="/outward"
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
            >
              Outward
            </NavLink>
            {user?.role === 'admin' && (
              <>
                <NavLink
                  to="/company-onboarding"
                  className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
                >
                  Company Onboarding
                </NavLink>
                <NavLink
                  to="/admin"
                  className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive} flex items-center gap-1.5`}
                >
                  <FiShield className="w-3.5 h-3.5 text-amber-400" />
                  Admin
                </NavLink>
              </>
            )}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationBell />
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

        {/* Mobile Page Navigation */}
        <div id="page-nav-links-mobile" className="md:hidden flex items-center gap-1 pb-2 -mt-1">
          <NavLink
            to="/"
            className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
          >
            Main
          </NavLink>
          <NavLink
            to="/inward"
            className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
          >
            Inward
          </NavLink>
          <NavLink
            to="/outward"
            className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
          >
            Outward
          </NavLink>
          {user?.role === 'admin' && (
            <>
              <NavLink
                to="/company-onboarding"
                className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
              >
                Company Onboarding
              </NavLink>
              <NavLink
                to="/admin"
                className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive} flex items-center gap-1.5`}
              >
                <FiShield className="w-3.5 h-3.5 text-amber-400" />
                Admin
              </NavLink>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
