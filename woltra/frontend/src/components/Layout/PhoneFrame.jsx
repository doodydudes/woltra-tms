export default function PhoneFrame({ children }) {
  return (
    <div className="phone-backdrop">
      <div className="phone-shell">
        {/* Dynamic island */}
        <div className="phone-island" />

        {/* App content */}
        <div className="phone-screen-content">
          {children}
        </div>

        {/* Home bar */}
        <div className="phone-home-bar" />

        {/* Side buttons */}
        <div className="phone-btn-mute" />
        <div className="phone-btn-vol-up" />
        <div className="phone-btn-vol-down" />
        <div className="phone-btn-power" />
      </div>
    </div>
  );
}
