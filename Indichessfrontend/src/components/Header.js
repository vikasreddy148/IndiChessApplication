import React from "react";
import { FaUser, FaRegEnvelope, FaCog } from "react-icons/fa";  // Import icons
import "./component-styles/Header.css";

const Header = ({ username }) => {
  return (
    <div className="header">
      {/* Left side: Hello User */}
      <div className="left">
        <p>Hello, User {username}</p>
      </div>

      {/* Right side: Icons */}
      <div className="right">
        <FaUser size={20} />
        <FaRegEnvelope size={20} />
        <FaCog size={20} />
      </div>
    </div>
  );
};

export default Header;
