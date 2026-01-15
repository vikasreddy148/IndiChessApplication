import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LoginCard from '../components/LoginCard';
import SignupCard from '../components/SignUpCard';
import { API_BASE_URL } from "../config/api";

function HomeCard() {
  const [showSignup, setShowSignup] = useState(false); // Track if we need to show SignupCard
  const [isAuthenticated, setIsAuthenticated] = useState(false); // To track authentication status
  const navigate = useNavigate(); // For navigation (redirecting to home)
  
  // Check if the user is already authenticated on component mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          method: "GET",
          credentials: "include",
        });

        // 200 => authenticated, 401 => not logged in (normal on login page)
        const data = await response.json().catch(() => null);
        if (response.ok && data?.authenticated) {
          setIsAuthenticated(true);
          navigate("/home");
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        // Network error only (don't spam console for expected unauthenticated state)
        console.error("Error checking authentication:", error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, [navigate]);

  const handleToggleSignup = () => {
    setShowSignup((prev) => !prev); // Toggle between login and signup
  };

  return (
    <div className="home-card">
      {isAuthenticated ? (
        // If authenticated, don't show the login/signup cards, just redirect to /home
        <div>Redirecting to Home...</div>
      ) : (
        <div>
          {showSignup ? (
            <SignupCard handleToggleSignup={handleToggleSignup} />
          ) : (
            <LoginCard handleToggleSignup={handleToggleSignup} />
          )}
        </div>
      )}
    </div>
  );
}

export default HomeCard;
