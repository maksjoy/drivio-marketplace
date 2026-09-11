/* Photo preparation runs locally; only the resized JPEG reaches Storage. */
(function () {
  'use strict';
  const fullLimit = 2200 * 1024;
  const thumbLimit = 350 * 1024;
  let heicDecoder;

  function validate(file) {
    if (!file || !file.size) throw new Error('This photo is empty. Choose another photo.');
    const type = (file.type || '').toLowerCase();
    const photoName = /\.(jpe?g|jfif|png|webp|heic|heif|avif|gif|bmp|tiff?)$/i.test(file.name || '');
    if (type === 'image/svg+xml' || /\.svgz?$/i.test(file.name || '') ||
        !(type.startsWith('image/') || ((!type || type === 'application/octet-stream') && photoName))) {
      throw new Error('Choose a photo such as JPEG, PNG, HEIC, WebP or AVIF.');
    }
    // No limit on the original byte size or dimensions. The encoded result is bounded below.
  }

  async function header(file) {
    const bytes = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
    const data = new DataView(bytes.buffer);
    const ascii = (offset, length) => String.fromCharCode(...bytes.subarray(offset, offset + length));
    const heic = /image\/hei[cf]/i.test(file.type || '') || /\.hei[cf]$/i.test(file.name || '') ||
      (ascii(4, 4) === 'ftyp' && /hei[cx]|hev[cx]|mif1|msf1/.test(ascii(8, 56)));
    let width = 0, height = 0, orientation = 1;
    if (bytes.length >= 24 && bytes[0] === 137 && ascii(1, 3) === 'PNG') {
      width = data.getUint32(16); height = data.getUint32(20);
    } else if (bytes.length >= 10 && ascii(0, 3) === 'GIF') {
      width = data.getUint16(6, true); height = data.getUint16(8, true);
    } else if (bytes[0] === 255 && bytes[1] === 216) {
      // Read JPEG dimensions and EXIF orientation without loading the full original into JS memory.
      for (let offset = 2; offset + 4 <= bytes.length;) {
        if (bytes[offset++] !== 255) break;
        while (bytes[offset] === 255) offset++;
        const marker = bytes[offset++];
        if (marker === 218 || marker === 217) break;
        const length = data.getUint16(offset), end = offset + length;
        if (length < 2 || end > bytes.length) break;
        if (marker === 225 && length >= 16 && ascii(offset + 2, 6) === 'Exif\0\0') {
          const tiff = offset + 8, little = ascii(tiff, 2) === 'II';
          const directory = tiff + data.getUint32(tiff + 4, little);
          if (directory >= tiff + 8 && directory + 2 <= end) {
            const count = data.getUint16(directory, little);
            for (let entry = directory + 2, i = 0; i < count && entry + 12 <= end; i++, entry += 12) {
              if (data.getUint16(entry, little) === 274 && data.getUint16(entry + 2, little) === 3 &&
                  data.getUint32(entry + 4, little) === 1) orientation = data.getUint16(entry + 8, little);
            }
          }
        }
        if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && length >= 7) {
          height = data.getUint16(offset + 3); width = data.getUint16(offset + 5);
        }
        offset = end;
      }
    }
    if (orientation >= 5 && orientation <= 8) [width, height] = [height, width];
    return { width, height, heic };
  }

  function fit(width, height, maxDim) {
    const scale = Math.min(1, maxDim / Math.max(width, height));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
  }

  async function decode(file, info, maxDim) {
    if (typeof window.createImageBitmap === 'function') {
      try {
        const options = { imageOrientation: 'from-image' };
        if (info.width && info.height) {
          const size = fit(info.width, info.height, maxDim);
          Object.assign(options, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'high' });
        }
        const bitmap = await window.createImageBitmap(file, options);
        return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
      } catch { /* Safari and older Telegram webviews may decode through an image element. */ }
    }
    const url = window.URL.createObjectURL(file);
    const image = new window.Image();
    const close = () => { image.onload = image.onerror = null; image.src = ''; window.URL.revokeObjectURL(url); };
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('Photo could not be decoded.'));
        image.src = url;
      });
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('Photo has no dimensions.');
      return { image, width: image.naturalWidth, height: image.naturalHeight, close };
    } catch (error) {
      close();
      if (!info.heic) throw error;
      // Load the pinned CSP-compatible decoder only on devices without native HEIC support.
      heicDecoder ||= import('/vendor/heic-to-1.5.2.js').catch(error => { heicDecoder = null; throw error; });
      const { heicTo } = await heicDecoder;
      if (typeof window.createImageBitmap === 'function') {
        const bitmap = await heicTo({ blob: file, type: 'bitmap' });
        return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
      }
      const jpeg = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 });
      return decode(jpeg, await header(jpeg), maxDim);
    }
  }

  function canvasFor(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) { canvas.width = canvas.height = 1; throw new Error('Photo processing is unavailable.'); }
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    return { canvas, context };
  }

  async function optimize(file, maxDim = 1920, quality = 0.86) {
    validate(file);
    const limit = maxDim <= 800 ? thumbLimit : fullLimit;
    let decoded, canvas;
    try {
      decoded = await decode(file, await header(file), maxDim);
      const size = fit(decoded.width, decoded.height, maxDim);
      const surface = canvasFor(size.width, size.height);
      canvas = surface.canvas;
      surface.context.drawImage(decoded.image, 0, 0, size.width, size.height);
      decoded.close(); decoded = null;
      // Retry with lower quality, then smaller dimensions. Never send an oversized original on failure.
      for (let pass = 0; pass < 8; pass++) {
        for (const q of [quality, Math.min(quality, 0.74), Math.min(quality, 0.62)]) {
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', q));
          if (blob?.size && blob.type === 'image/jpeg' && blob.size <= limit) return blob;
        }
        const smaller = canvasFor(Math.max(1, Math.floor(canvas.width * 0.75)), Math.max(1, Math.floor(canvas.height * 0.75)));
        smaller.context.drawImage(canvas, 0, 0, smaller.canvas.width, smaller.canvas.height);
        canvas.width = canvas.height = 1;
        canvas = smaller.canvas;
      }
      throw new Error('Photo could not be prepared.');
    } catch (error) {
      const label = file.name ? '“' + file.name + '”' : 'This photo';
      throw new Error(label + ' could not be processed on this device. Try selecting it from your photo library again.', { cause: error });
    } finally {
      decoded?.close();
      if (canvas) canvas.width = canvas.height = 1;
    }
  }

  window.P2PPhotos = Object.freeze({ validate, optimize, fullLimit, thumbLimit });
})();
