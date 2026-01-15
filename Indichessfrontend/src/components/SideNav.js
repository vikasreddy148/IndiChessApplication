import React, { useState } from 'react';
import "./component-styles/SideNav.css";
import { FaChessPawn, FaSun, FaCog, FaBars, FaSignOutAlt } from 'react-icons/fa';  // Icons for the menu items
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

const SideNav = () => {
  const [lightMode, setLightMode] = useState(false);  // To toggle between light and dark UI
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();

  const handleToggleLightMode = () => {
    setLightMode(!lightMode);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch(`${API_BASE_URL}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      // best-effort; even if server is down, we still route user back to login
      console.error("Logout failed:", e);
    } finally {
      setIsLoggingOut(false);
      navigate("/");
    }
  };

  return (
    <div className={`side-nav ${lightMode ? 'light-mode' : ''}`}>
      <div className="logo">
        <h2>Chess.com</h2>
        <FaChessPawn size={40} />
      </div>

      <div className="menu">
        <button className="menu-item">
          <FaChessPawn size={20} />
          Play
        </button>
      </div>

      <div className="settings">
        <button className="settings-item" onClick={handleToggleLightMode}>
          <FaSun size={20} />
          Light UI
        </button>
        <button className="settings-item">
          <FaBars size={20} />
          Collapse
        </button>
        <button className="settings-item">
          <FaCog size={20} />
          Settings
        </button>
        <button className="settings-item">
          <FaBars size={20} />
          Support
        </button>
        <button className="settings-item" onClick={handleLogout} disabled={isLoggingOut}>
          <FaSignOutAlt size={20} />
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  );
};

export default SideNav;
