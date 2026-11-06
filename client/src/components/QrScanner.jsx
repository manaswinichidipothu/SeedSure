import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, CameraOff, ImageUp, RefreshCw, Square } from "lucide-react";

const READER_ID = "seedsure-qr-reader";
const FILE_READER_ID = "seedsure-qr-file-reader";

function explainCameraError(err) {
  const text = `${err?.name || ""} ${err?.message || ""} ${typeof err === "string" ? err : ""}`;
  if (/NotAllowed|Permission|denied/i.test(text)) {
    return "Camera permission was blocked. Allow camera access for this site in your browser settings (usually the lock icon in the address bar), then press Start camera again.";
  }
  if (/NotFound|Overconstrained|no camera|Requested device not found/i.test(text)) return "No camera was found on this device.";
  if (/NotReadable|TrackStart|in use/i.test(text)) return "The camera is busy. Close other apps or tabs that are using it and try again.";
  if (/secure|https/i.test(text)) return "The camera needs a secure (HTTPS) connection.";
  return "Could not start the camera. You can still upload a photo of the QR code or type the batch code below.";
}

/**
 * Live camera QR scanner.
 * onDetected(text, source) -> return true if the text was accepted (scanner stops),
 * false to keep scanning (e.g. the QR code was not a SeedSure code).
 */
export default function QrScanner({ onDetected }) {
  const scannerRef = useRef(null);
  const lastRef = useRef({ text: "", at: 0 });
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [state, setState] = useState("idle"); // idle | starting | scanning | error
  const [error, setError] = useState("");
  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState("");
  const [fileBusy, setFileBusy] = useState(false);

  const stop = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try { if (scanner.isScanning) await scanner.stop(); } catch { /* already stopped */ }
    try { scanner.clear(); } catch { /* nothing to clear */ }
  }, []);

  // Always release the camera when leaving the page.
  useEffect(() => () => { stop(); }, [stop]);

  const handleDecoded = useCallback((text) => {
    const now = Date.now();
    // The camera sees the same code ~10x per second: ignore repeats for 3 seconds.
    if (lastRef.current.text === text && now - lastRef.current.at < 3000) return;
    lastRef.current = { text, at: now };
    const accepted = onDetectedRef.current(text, "camera");
    if (accepted) stop().then(() => setState("idle"));
  }, [stop]);

  const start = useCallback(async (deviceId) => {
    setError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState("error");
      setError("Camera access needs a secure (HTTPS) connection. Upload a photo of the QR code instead, or open the site over HTTPS.");
      return;
    }
    setState("starting");
    try {
      await stop();
      const scanner = new Html5Qrcode(READER_ID, { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] });
      scannerRef.current = scanner;
      await scanner.start(
        deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" },
        {
          fps: 10,
          aspectRatio: 1,
          qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.72); return { width: s, height: s }; },
        },
        handleDecoded,
        () => { /* "no QR in this frame" fires constantly: ignore */ }
      );
      setState("scanning");
      // Camera labels are only available after permission has been granted.
      Html5Qrcode.getCameras().then((list) => setCameras(list)).catch(() => {});
    } catch (err) {
      await stop();
      setState("error");
      setError(explainCameraError(err));
    }
  }, [handleDecoded, stop]);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileBusy(true);
    setError("");
    try {
      await stop();
      setState("idle");
      const reader = new Html5Qrcode(FILE_READER_ID, { verbose: false });
      let text;
      try { text = await reader.scanFile(file, false); } finally { try { reader.clear(); } catch { /* ignore */ } }
      if (!onDetectedRef.current(text, "image")) setError("A QR code was found, but it isn't a SeedSure batch code.");
    } catch {
      setError("No QR code could be read from that image. Try a sharper, well-lit photo with the whole code in view.");
    } finally {
      setFileBusy(false);
    }
  }

  const scanning = state === "scanning";
  return (
    <div className="scanner">
      <div className={`scanner-stage ${scanning ? "live" : ""}`}>
        <div id={READER_ID} className="scanner-video" />
        {!scanning && (
          <div className="scanner-placeholder">
            {state === "error" ? <CameraOff size={38} /> : <Camera size={38} />}
            <span>{state === "starting" ? "Starting camera…" : "Point your camera at the QR code on the seed packet"}</span>
          </div>
        )}
      </div>
      <div id={FILE_READER_ID} hidden />

      <div className="scanner-actions">
        {scanning ? (
          <button type="button" className="btn btn-secondary" onClick={() => { stop().then(() => setState("idle")); }}><Square size={16} /> Stop camera</button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={state === "starting"} onClick={() => start(cameraId || undefined)}>
            <Camera size={17} /> {state === "error" ? "Try again" : "Start camera"}
          </button>
        )}
        <label className={`btn btn-secondary file-btn ${fileBusy ? "disabled" : ""}`}>
          <ImageUp size={16} /> {fileBusy ? "Reading…" : "Upload / take photo"}
          <input type="file" accept="image/*" capture="environment" onChange={onFile} disabled={fileBusy} hidden />
        </label>
        {cameras.length > 1 && (
          <label className="camera-select">
            <RefreshCw size={14} />
            <select value={cameraId} aria-label="Choose camera" onChange={(e) => { setCameraId(e.target.value); start(e.target.value); }}>
              <option value="">Default camera</option>
              {cameras.map((c) => <option key={c.id} value={c.id}>{c.label || `Camera ${c.id.slice(0, 6)}`}</option>)}
            </select>
          </label>
        )}
      </div>
      {error && <div className="inline-error" role="alert">{error}</div>}
    </div>
  );
}
