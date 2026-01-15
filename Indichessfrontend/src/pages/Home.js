import React, { useEffect, useState } from "react";
import SideNav from "../components/SideNav";
import Header from "../components/Header";
import GameInfo from "../components/game-page-components/GameInfo";

function HomePage() {
  // console.log(Response);
  return (
    <div className="app-container">
      <SideNav /> {/* Render the SideNav */}
      <div className="main-container">
        <Header />
        <div className="game-info-container">
          <GameInfo />
        </div>
      </div>
      
    </div>
    
  );
}

export default HomePage;
