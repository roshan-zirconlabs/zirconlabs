import NebulaCanvas from "@/components/landing/NebulaCanvas";
import Starfield from "@/components/landing/Starfield";
import LandingNav from "@/components/landing/LandingNav";
import Hero from "@/components/landing/Hero";
import SignalMarquee from "@/components/landing/SignalMarquee";
import MissionSequence from "@/components/landing/MissionSequence";
import OrbitalSystem from "@/components/landing/OrbitalSystem";
import HeatShields from "@/components/landing/HeatShields";
import LaunchWindow from "@/components/landing/LaunchWindow";
import { LandingMotion } from "@/components/landing/motion";
import "@/components/landing/landing.css";

export default function Home() {
  return (
    <div className="cosmos relative min-h-screen overflow-x-clip">
      <NebulaCanvas />
      <Starfield />
      <LandingMotion>
        <LandingNav />
        <main id="main" className="relative z-10">
          <Hero />
          <SignalMarquee />
          <MissionSequence />
          <OrbitalSystem />
          <HeatShields />
          <LaunchWindow />
        </main>
      </LandingMotion>
    </div>
  );
}
