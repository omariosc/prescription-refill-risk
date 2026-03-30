export default function UnsupportedOverlay() {
  return (
    <div className="unsupported-overlay">
      <div className="unsupported-content">
        <svg viewBox="0 0 239 239" width="64" height="64" xmlns="http://www.w3.org/2000/svg">
          <rect fill="#00e0bc" y="139" width="100" height="100" rx="5"/>
          <path fill="#00e0bc" d="M48,0h46c3,0,6,2,6,5v89c0,3-2,5-6,5H5c-3,0-5-2-5-5V48C0,21,21,0,48,0Z"/>
          <rect fill="#00e0bc" x="139" width="100" height="100" rx="5"/>
          <path fill="#00e0bc" d="M145,139h89c3,0,5,2,5,5v47c0,26-21,48-48,48h-46c-3,0-6-2-6-6V145c0-3,3-6,6-6Z"/>
        </svg>
        <h2>Screen Size Not Supported</h2>
        <p>The Refill Risk Tool requires a larger screen. Please use a tablet or desktop device for the best experience.</p>
      </div>
    </div>
  );
}
