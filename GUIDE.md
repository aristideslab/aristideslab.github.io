# TDLidar — How to Use with TouchDesigner

A complete guide to streaming real-time depth data from your iPhone to TouchDesigner using TDLidar.

---

## Table of Contents

1. [What You Need](#what-you-need)
2. [Supported iPhones](#supported-iphones)
3. [Initial Setup](#initial-setup)
4. [Connecting to TouchDesigner](#connecting-to-touchdesigner)
5. [Understanding the Depth Output](#understanding-the-depth-output)
6. [Depth Modes Explained](#depth-modes-explained)
7. [Settings Guide](#settings-guide)
8. [TouchDesigner Shader Examples](#touchdesigner-shader-examples)
9. [Tips for Best Results](#tips-for-best-results)
10. [Troubleshooting](#troubleshooting)
11. [FAQ](#faq)

---

## What You Need

- **An iPhone** with a TrueDepth front camera (iPhone X or later — see full list below)
- **A computer** running TouchDesigner (or any NDI-compatible software)
- **A Wi-Fi network** — both your iPhone and computer must be on the same network
- **TouchDesigner** 2022.20000+ (any edition, including the free Non-Commercial version)

That's it. No cables, no extra apps, no NDI Tools installation required on your computer. TouchDesigner has NDI support built in.

---

## Supported iPhones

TDLidar uses the TrueDepth camera (the front-facing selfie camera with depth sensing). Every iPhone from the iPhone X onwards has this sensor:

| iPhone | TrueDepth | Works with TDLidar |
|--------|-----------|-------------------|
| iPhone X | Yes | Yes |
| iPhone XR | Yes | Yes |
| iPhone XS / XS Max | Yes | Yes |
| iPhone 11 / 11 Pro / 11 Pro Max | Yes | Yes |
| iPhone 12 / 12 mini / 12 Pro / 12 Pro Max | Yes | Yes |
| iPhone 13 / 13 mini / 13 Pro / 13 Pro Max | Yes | Yes |
| iPhone 14 / 14 Plus / 14 Pro / 14 Pro Max | Yes | Yes |
| iPhone 15 / 15 Plus / 15 Pro / 15 Pro Max | Yes | Yes |
| iPhone 16 / 16 Plus / 16 Pro / 16 Pro Max | Yes | Yes |
| iPhone SE (2nd/3rd gen) | No | No |

**Note:** TDLidar uses the front-facing TrueDepth camera, not the rear LiDAR scanner found on Pro models. You point the screen at your subject.

---

## Initial Setup

### Step 1: Install TDLidar

Download TDLidar from the App Store on your iPhone.

### Step 2: Grant Permissions

When you first open TDLidar, it will ask for two permissions:

1. **Camera Access** — Required to capture depth data from the TrueDepth sensor. Tap "Allow."
2. **Local Network Access** — Required to stream NDI data over your Wi-Fi network. Tap "Allow."

Both permissions are essential. If you accidentally deny either one, go to Settings > TDLidar on your iPhone to re-enable them.

### Step 3: Connect to Wi-Fi

Make sure your iPhone is on the same Wi-Fi network as your computer running TouchDesigner. This is the most common issue — if they're on different networks, TouchDesigner won't see the stream.

**Tip:** If you're at a venue or studio with multiple networks (like a guest network and a production network), make sure both devices are on the same one.

### Step 4: Start Streaming

1. Open TDLidar on your iPhone
2. Wait for the camera to initialize (you'll see a brief loading screen)
3. Tap the blue **"Start NDI"** button at the bottom
4. The button turns red and shows **"Stop NDI"** — you're now streaming
5. The status bar at the top shows "Streaming as 'TDLidar'" and displays the number of connected receivers

---

## Connecting to TouchDesigner

### Step 1: Add an NDI In TOP

1. Open TouchDesigner on your computer
2. Press **Tab** to open the operator menu
3. Search for **"NDI In"** and place it in your network
4. Alternatively: right-click > Add Operator > TOP > NDI In

### Step 2: Select the TDLidar Source

1. Click on the NDI In TOP to select it
2. In the parameters panel on the right, find the **"Source Name"** dropdown
3. Click it — you should see **"TDLidar"** listed as an available source
4. Select it

**If you don't see "TDLidar":**
- Make sure streaming is active on your iPhone (red "Stop NDI" button visible)
- Make sure both devices are on the same Wi-Fi network
- Wait a few seconds — NDI discovery can take a moment
- Try clicking the refresh button next to the Source Name dropdown

### Step 3: Verify the Stream

Once connected, you should see a grayscale depth image in the NDI In TOP. Bright areas are close to the camera, dark areas are far away. The resolution info capsule on the iPhone will show something like `480x640 @ 30fps`.

In TouchDesigner, the NDI In TOP's info will show the stream resolution, frame rate, and codec.

---

## Understanding the Depth Output

TDLidar sends depth data as a **grayscale BGRA video stream** over NDI. By default:

- **Bright pixels** = close to the camera (near)
- **Dark pixels** = far from the camera
- **Black pixels** = out of range or clipped

The depth values are encoded as 8-bit grayscale — all three color channels (R, G, B) contain the same value, and alpha is always 255. This means you can use the stream directly as a luminance/displacement map in TouchDesigner without any shader decoding.

### Using the Stream Directly (No Shader Needed)

For many use cases, you can use the NDI In TOP output directly:

- **Displacement mapping:** Wire the NDI In TOP into a Noise SOP or use it as a displacement texture
- **Masking/keying:** Use a Threshold TOP to isolate depth ranges
- **Particles:** Use the depth as a force field or emission map
- **Projection mapping:** Map depth to geometry for real-time 3D effects

### Using a GLSL Shader (Advanced)

For more control over the depth visualization, see the [TouchDesigner Shader Examples](#touchdesigner-shader-examples) section below.

---

## Depth Modes Explained

TDLidar has two main depth modes plus a legacy mode. You can switch between them in Settings > Depth Output.

### Environment Mode

Best for capturing a full scene. Maps the entire depth range (up to 1m, 2m, 3m, 5m, or 8m) to the grayscale output.

**When to use:**
- Full-body tracking
- Room scanning
- Installations where you need to see the whole environment
- Far-range depth capture

**Settings:**
- **Max Range:** Controls how far the depth extends. Everything beyond this range becomes black. Use 1-2m for close-up work, 5-8m for full-room capture.

### Face Detail Mode (Default)

Best for capturing fine facial detail. Automatically centers on the subject's depth and maps a very narrow window (as small as +/-20mm) to the full grayscale range. This gives you dramatically higher precision for face/body close-ups.

**When to use:**
- Face tracking and facial detail capture
- Portrait-style depth
- Any close-up work where you need fine depth resolution
- Interactive installations where people stand at varying distances

**Settings:**
- **Detail Range:** How wide the depth window is around the subject. Smaller values = more precision. At 50mm, each grayscale step represents about 0.4mm of depth change.
- **Tracking Speed:** How fast the depth center follows the subject. Lower = more stable (good for static subjects). Higher = more responsive (good for moving subjects).

### Raw Depth Mode (Legacy)

Recreates the original v1 output — raw sensor data encoded as green topographic contours. This mode bypasses all processing (no smoothing, no clipping, no brightness/contrast/gamma adjustments).

**When to use:**
- When you want the original glitchy, unfiltered aesthetic
- Creative/artistic applications where the raw look is desirable
- Debugging sensor behavior

**How to enable:** Settings > Legacy > Raw Depth Mode toggle

---

## Settings Guide

### NDI Stream
- **Source Name:** Always "TDLidar." This is what appears in TouchDesigner's NDI source list.

### Depth Output
- **Mode:** Switch between Environment and Face Detail (see above)
- **Max Range (Environment):** 1m, 2m, 3m, 5m, or 8m. Controls the far boundary of the depth map.
- **Detail Range (Face Detail):** 20mm to 200mm. Width of the depth window around the subject.
- **Tracking Speed (Face Detail):** 5% to 50%. How quickly the center point follows subject movement.
- **Resolution:** Choose between available depth resolutions from the TrueDepth sensor.

### Filtering
- **Apple Depth Filtering:** On by default. Apple's built-in hole-filling and noise reduction. Turn it off for raw, unfiltered sensor data (more noise, but no interpolation artifacts).
- **Temporal Smoothing:** 0% to 80%. Blends current frame with previous frames to reduce flicker. Higher values = smoother but more latency.

### Output Adjustments
- **Invert Depth:** Swaps near/far brightness. Default: near = bright. Toggle this if your TouchDesigner setup expects the opposite.
- **Brightness:** Shifts all depth values brighter or darker (-50% to +50%).
- **Contrast:** Expands or compresses the grayscale range (0.5x to 2.0x). Higher contrast makes depth differences more visible.
- **Gamma:** Non-linear brightness curve. Below 1.0 brightens dark areas (reveals far detail). Above 1.0 darkens them (isolates near objects).

### Depth Clipping
- **Near Clip:** Pixels closer than this distance become black. Useful for removing your hand or phone holder from the depth map. Range: 0 to 1.0m.
- **Far Clip:** Pixels farther than this distance become black. Useful for removing the background. Range: 0.5m to 10.0m.

### Performance
- **Frame Rate:** 10, 15, 24, or 30 fps. Higher = smoother but uses more battery and generates more heat. For most TouchDesigner projects, 24 fps is a good balance.

### Permissions
- **App Settings:** Quick link to the iOS Settings app where you can manage Camera and Local Network permissions.

### Legacy
- **Raw Depth Mode:** Toggle the original v1 green topographic output. See [Raw Depth Mode](#raw-depth-mode-legacy) above.

---

## TouchDesigner Shader Examples

You can use the NDI In TOP output directly in most cases. But if you want custom depth visualization, here are some GLSL TOP shaders you can use in TouchDesigner.

### Basic Depth (Direct Use — No Shader)

Just wire the NDI In TOP into whatever you need. The grayscale output works directly as:
- A displacement map (Noise SOP, Point SOP)
- A mask (Threshold TOP, Limit TOP)
- A texture (any material)
- A particle emission map

### Heatmap Visualization

Create a GLSL TOP, wire the NDI In TOP into input 0, and paste this shader:

```glsl
// Depth Heatmap — blue=near, red=far
uniform sampler2D sColorMap;
out vec4 fragColor;

vec3 heatmap(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c;
    c.r = smoothstep(0.4, 0.8, t);
    c.g = smoothstep(0.1, 0.5, t) - smoothstep(0.5, 0.9, t);
    c.b = 1.0 - smoothstep(0.0, 0.5, t);
    return c;
}

void main() {
    vec4 color = texture(sColorMap, vUV.st);
    float depth = color.r;  // Grayscale — R=G=B
    fragColor = vec4(heatmap(depth), 1.0);
}
```

### Edge Detection (Depth Contours)

```glsl
// Depth Edge Detection — highlights depth boundaries
uniform sampler2D sColorMap;
out vec4 fragColor;

void main() {
    vec2 uv = vUV.st;
    vec2 texel = 1.0 / textureSize(sColorMap, 0);

    float c = texture(sColorMap, uv).r;
    float l = texture(sColorMap, uv + vec2(-texel.x, 0)).r;
    float r = texture(sColorMap, uv + vec2(texel.x, 0)).r;
    float t = texture(sColorMap, uv + vec2(0, texel.y)).r;
    float b = texture(sColorMap, uv + vec2(0, -texel.y)).r;

    float edge = abs(l - r) + abs(t - b);
    edge = smoothstep(0.01, 0.1, edge);

    fragColor = vec4(vec3(edge), 1.0);
}
```

### Threshold Mask (Isolate Depth Range)

```glsl
// Depth Threshold — isolate a specific depth range
uniform sampler2D sColorMap;
uniform float uNear;  // Add a Uniform DAT, default 0.3
uniform float uFar;   // Add a Uniform DAT, default 0.7
out vec4 fragColor;

void main() {
    float depth = texture(sColorMap, vUV.st).r;
    float mask = step(uNear, depth) * step(depth, uFar);
    fragColor = vec4(vec3(mask), 1.0);
}
```

---

## Tips for Best Results

### Lighting
- The TrueDepth sensor uses infrared, so it works in any lighting condition — including complete darkness.
- Direct sunlight can interfere with the IR sensor. For outdoor use, stay in shade or use the sensor at close range.

### Distance
- **Best range: 0.2m to 2.0m** (about arm's length to 6 feet)
- The TrueDepth sensor is designed for face-distance use. Quality drops beyond 2-3 meters.
- For the best facial detail, keep the subject 30-60cm from the phone.

### Phone Placement
- TDLidar uses the **front camera** — point the screen at your subject.
- Use a phone mount, tripod with phone adapter, or prop the phone against something stable.
- The depth map rotates automatically to portrait orientation in the output.

### Performance
- **30 fps** gives the smoothest output but generates the most heat. For long sessions, try 24 or 15 fps.
- If the phone gets warm, TDLidar automatically reduces the frame rate temporarily and shows an orange thermometer icon. It will restore the original frame rate when the phone cools down.
- Closing other apps on your iPhone helps reduce heat.
- Keeping your phone plugged in helps with extended streaming sessions but may increase heat — use a fan or cool surface.

### Network
- **5GHz Wi-Fi is strongly recommended.** The 2.4GHz band is more congested and adds latency.
- A dedicated/isolated Wi-Fi network (like a portable router in a venue) gives the most reliable results.
- Wired Ethernet on your computer + Wi-Fi on the phone is the most stable setup.
- Avoid networks with captive portals (hotel Wi-Fi, conference Wi-Fi) — they often block local network traffic.

### TouchDesigner Settings
- Set the NDI In TOP's **"Deinterlace"** to **Off** (the stream is already progressive).
- If you see latency, reduce the NDI In TOP's **"Buffer Size"** to 1 or 2 frames.
- For displacement mapping, use a **Level TOP** or **Lookup TOP** after the NDI In to fine-tune the depth range before feeding it to geometry.

---

## Troubleshooting

### "TDLidar" doesn't appear in TouchDesigner

1. **Check Wi-Fi:** Both devices must be on the exact same network. Open Safari on your iPhone and try loading a webpage to confirm you're connected.
2. **Check permissions:** On your iPhone, go to Settings > TDLidar and make sure "Local Network" is enabled.
3. **Check firewall:** On your computer, make sure your firewall allows TouchDesigner to receive network connections. On macOS, check System Settings > Network > Firewall.
4. **Restart the stream:** Tap "Stop NDI" then "Start NDI" again on the iPhone.
5. **Restart TouchDesigner:** Sometimes the NDI source list needs a moment to refresh.
6. **Check for network isolation:** Some routers have "client isolation" or "AP isolation" enabled, which prevents devices from seeing each other. Check your router settings.

### Stream is laggy or choppy

1. **Switch to 5GHz Wi-Fi** if you're on 2.4GHz.
2. **Reduce frame rate** to 15 or 24 fps in TDLidar Settings > Performance.
3. **Reduce NDI In buffer** in TouchDesigner to 1-2 frames.
4. **Close other apps** on your iPhone.
5. **Move closer to the router** — weak signal increases packet loss.

### Phone gets hot

1. **Reduce frame rate** to 15 or 24 fps. This is the single biggest thermal reduction.
2. **Remove the phone case** — cases trap heat.
3. **Point a small fan at the phone** for extended sessions.
4. TDLidar automatically reduces frame rate when the phone overheats and restores it when it cools down.

### Depth map looks noisy or has holes

1. **Enable Apple Depth Filtering** in Settings > Filtering (on by default).
2. **Increase Temporal Smoothing** to 30-50% for a cleaner output.
3. **Move closer** to the subject — the sensor is most accurate within 1 meter.
4. **Avoid reflective or transparent surfaces** — glass, mirrors, and shiny objects confuse depth sensors.

### Depth map is all black

1. **Check clipping settings:** Make sure Far Clip is set beyond your subject's distance.
2. **Check Max Range (Environment mode):** If set to 1m but your subject is 2m away, everything will be clipped.
3. **Make sure the front camera isn't obstructed** — check for screen protectors covering the TrueDepth sensor area.

### Stream disconnects randomly

1. **Check Wi-Fi signal strength** — weak signal causes drops.
2. **Disable Wi-Fi power saving** on your computer if available.
3. **Use a dedicated network** — busy networks with many devices can cause interference.
4. **Keep the phone screen on** — iOS may throttle background network activity.

---

## FAQ

### Q: Does TDLidar use the rear LiDAR scanner on Pro iPhones?

No. TDLidar uses the front-facing TrueDepth camera, which is available on all iPhones from iPhone X onwards. The rear LiDAR scanner (available on iPhone 12 Pro and later) is a different sensor. TDLidar uses the front camera so you can see the screen while streaming.

### Q: Can I use TDLidar with software other than TouchDesigner?

Yes. TDLidar streams standard NDI video. Any software that supports NDI input can receive the stream, including:
- Notch
- Resolume
- OBS Studio (with NDI plugin)
- vMix
- Isadora
- Any custom application using the NDI SDK

### Q: What resolution is the depth output?

The TrueDepth sensor typically outputs depth at 640x480 or lower, depending on the device and selected format. You can choose between available resolutions in Settings > Depth Output > Resolution.

### Q: Can I stream to multiple computers at once?

Yes. NDI supports multiple receivers. The connection count indicator on TDLidar's main screen shows how many receivers are connected. All receivers get the same stream.

### Q: Does TDLidar work over the internet / different networks?

No. NDI is a local network protocol designed for low-latency streaming on the same subnet. Both devices must be on the same Wi-Fi network.

### Q: Can I use TDLidar while the phone is locked?

No. iOS pauses camera access when the phone is locked. Keep the phone unlocked while streaming. You can adjust Auto-Lock in iOS Settings > Display & Brightness to prevent the screen from turning off.

### Q: How much battery does TDLidar use?

Continuous streaming at 30 fps uses significant battery — roughly similar to video recording. For long sessions (over 30 minutes), we recommend:
- Plugging in to power
- Reducing frame rate to 15 or 24 fps
- Using a phone fan or cool surface

### Q: What's the latency?

On a good 5GHz Wi-Fi network, latency is typically 2-4 frames (60-130ms at 30fps). This is fast enough for real-time interactive installations. For the lowest latency:
- Use 5GHz Wi-Fi
- Reduce the NDI In TOP buffer to 1 frame in TouchDesigner
- Keep temporal smoothing low or off
- Stay close to the router

### Q: Can I record the depth stream in TouchDesigner?

Yes. Use a Movie File Out TOP connected to the NDI In TOP to record the depth stream as a video file. Use a lossless codec (like Animation or PNG sequence) to preserve depth precision.

### Q: What is the "Raw Depth Mode" in Legacy settings?

This recreates the output from TDLidar v1 — raw sensor data rendered as green topographic contour lines. It bypasses all processing (smoothing, clipping, brightness/contrast/gamma). Some users prefer this aesthetic for creative projects. It's a gimmick mode — the default grayscale output is better for technical use.

### Q: Why does the depth map look different on different iPhones?

Each iPhone generation has slightly different TrueDepth sensor specifications. Newer iPhones generally have better depth resolution and less noise. The core functionality is the same across all supported devices, but you may notice quality differences between an iPhone X and an iPhone 16.

### Q: Can I use TDLidar for body tracking?

Yes, but with limitations. The TrueDepth sensor is optimized for face-distance use (30-60cm). For full-body work, use Environment mode with a higher max range. Quality decreases with distance, and the sensor may not capture legs/feet well beyond 2 meters.

### Q: How do I use the depth map for displacement in TouchDesigner?

1. Add an NDI In TOP and connect to TDLidar
2. Add a Grid SOP (or any geometry)
3. Add a Point SOP after the Grid
4. In the Point SOP, set the Y position to reference the NDI In TOP using a Texture SOP or CHOP
5. Alternatively, use a GLSL MAT or Phong MAT with the depth as a displacement map

For a quick setup:
1. NDI In TOP > Noise SOP (use depth as noise input)
2. Or: NDI In TOP > Convert to CHOP > SOP displacement

### Q: Is there a way to get higher precision depth data?

Use **Face Detail mode** with a small Detail Range (20-50mm). This maps the full 8-bit grayscale range to a very narrow depth window, giving you sub-millimeter precision. At 20mm range, each grayscale step represents about 0.16mm.

### Q: My antivirus/firewall is blocking the connection. What do I whitelist?

NDI uses mDNS (Bonjour) for discovery and TCP/UDP for data transfer. You need to allow:
- **mDNS/Bonjour:** UDP port 5353
- **NDI:** TCP port 5960+ (dynamic, assigned per source)
- Allow TouchDesigner through your firewall

### Q: Can I change the NDI source name from "TDLidar"?

Currently the source name is fixed as "TDLidar." This makes it easy to find in any NDI receiver.

---

## Need Help?

If you run into issues not covered here, check the GitHub repository for updates and known issues:

https://github.com/aristideslintzeris/TDLidar

You can also open an issue on GitHub with a description of your problem, your iPhone model, and your TouchDesigner version.
