/**
 * Reversible Typed Serialization for Firestore Data Types
 * Preserves exact types across export and import:
 * - Timestamp
 * - GeoPoint
 * - DocumentReference
 * - Bytes
 * - Null, Boolean, Number, String, Array, Map
 */

export interface SerializedTypeMarker {
  __type__: 'Timestamp' | 'GeoPoint' | 'DocumentReference' | 'Bytes';
  [key: string]: any;
}

export function isSerializedTypeMarker(val: any): val is SerializedTypeMarker {
  return (
    val !== null &&
    typeof val === 'object' &&
    typeof val.__type__ === 'string' &&
    ['Timestamp', 'GeoPoint', 'DocumentReference', 'Bytes'].includes(val.__type__)
  );
}

/**
 * Serialize a value into a JSON-compatible structure with reversible type annotations.
 */
export function serializeFirestoreValue(val: any): any {
  if (val === null || val === undefined) {
    return null;
  }

  // Check if it's already a serialized type marker
  if (isSerializedTypeMarker(val)) {
    return val;
  }

  // 1. Timestamp (Firebase Admin Timestamp, client Timestamp, or Date)
  if (val instanceof Date) {
    return {
      __type__: 'Timestamp',
      seconds: Math.floor(val.getTime() / 1000),
      nanoseconds: (val.getTime() % 1000) * 1000000,
      iso: val.toISOString(),
    };
  }

  if (
    typeof val === 'object' &&
    typeof val.toDate === 'function' &&
    typeof val.seconds === 'number'
  ) {
    const d: Date = val.toDate();
    return {
      __type__: 'Timestamp',
      seconds: val.seconds,
      nanoseconds: typeof val.nanoseconds === 'number' ? val.nanoseconds : 0,
      iso: d.toISOString(),
    };
  }

  // Timestamp object with _seconds (Admin SDK internal representation)
  if (
    typeof val === 'object' &&
    typeof val._seconds === 'number' &&
    typeof val._nanoseconds === 'number'
  ) {
    const d = new Date(val._seconds * 1000 + Math.floor(val._nanoseconds / 1000000));
    return {
      __type__: 'Timestamp',
      seconds: val._seconds,
      nanoseconds: val._nanoseconds,
      iso: d.toISOString(),
    };
  }

  // 2. GeoPoint
  if (
    typeof val === 'object' &&
    (typeof val.latitude === 'number' || typeof val._latitude === 'number') &&
    (typeof val.longitude === 'number' || typeof val._longitude === 'number')
  ) {
    return {
      __type__: 'GeoPoint',
      latitude: typeof val.latitude === 'number' ? val.latitude : val._latitude,
      longitude: typeof val.longitude === 'number' ? val.longitude : val._longitude,
    };
  }

  // 3. DocumentReference
  if (
    typeof val === 'object' &&
    typeof val.path === 'string' &&
    (typeof val.id === 'string' || typeof val.parent === 'object')
  ) {
    return {
      __type__: 'DocumentReference',
      path: val.path,
    };
  }

  // 4. Bytes / Buffer
  if (Buffer.isBuffer(val)) {
    return {
      __type__: 'Bytes',
      base64: val.toString('base64'),
    };
  }

  if (val instanceof Uint8Array) {
    return {
      __type__: 'Bytes',
      base64: Buffer.from(val).toString('base64'),
    };
  }

  // 5. Arrays (recursively serialize each item)
  if (Array.isArray(val)) {
    return val.map((item) => serializeFirestoreValue(item));
  }

  // 6. Plain Objects / Maps (recursively serialize each property)
  if (typeof val === 'object') {
    const serializedObj: Record<string, any> = {};
    for (const [key, propVal] of Object.entries(val)) {
      // Skip undefined or functions
      if (typeof propVal === 'function' || propVal === undefined) continue;
      serializedObj[key] = serializeFirestoreValue(propVal);
    }
    return serializedObj;
  }

  // 7. Primitives: string, number, boolean
  return val;
}

/**
 * Deserializes an annotated JSON value back into native Firestore types or rich structures.
 * Accepts an optional Firestore SDK provider (or constructor references) to instantiate exact native types.
 */
export function deserializeFirestoreValue(
  val: any,
  firestoreConstructors?: {
    Timestamp?: { fromMillis: (ms: number) => any };
    GeoPoint?: new (lat: number, lng: number) => any;
  }
): any {
  if (val === null || val === undefined) {
    return null;
  }

  if (isSerializedTypeMarker(val)) {
    switch (val.__type__) {
      case 'Timestamp': {
        const ms = val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000);
        if (firestoreConstructors?.Timestamp?.fromMillis) {
          return firestoreConstructors.Timestamp.fromMillis(ms);
        }
        return new Date(ms);
      }
      case 'GeoPoint': {
        if (firestoreConstructors?.GeoPoint) {
          return new firestoreConstructors.GeoPoint(val.latitude, val.longitude);
        }
        return { latitude: val.latitude, longitude: val.longitude };
      }
      case 'DocumentReference': {
        return {
          __type__: 'DocumentReference',
          path: val.path,
        };
      }
      case 'Bytes': {
        return Buffer.from(val.base64, 'base64');
      }
    }
  }

  if (Array.isArray(val)) {
    return val.map((item) => deserializeFirestoreValue(item, firestoreConstructors));
  }

  if (typeof val === 'object') {
    const deserializedObj: Record<string, any> = {};
    for (const [key, propVal] of Object.entries(val)) {
      deserializedObj[key] = deserializeFirestoreValue(propVal, firestoreConstructors);
    }
    return deserializedObj;
  }

  return val;
}

/**
 * Deep equality and diff detector between two document states
 */
export function areDocumentsIdentical(docA: any, docB: any): boolean {
  if (docA === docB) return true;
  if (!docA || !docB) return false;
  return JSON.stringify(serializeFirestoreValue(docA)) === JSON.stringify(serializeFirestoreValue(docB));
}
