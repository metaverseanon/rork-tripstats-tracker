import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const BUCKET_NAME = 'user-images';

function isRemoteUrl(uri: string): boolean {
  return uri.startsWith('http://') || uri.startsWith('https://');
}

function isLocalFileUri(uri: string): boolean {
  return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://');
}

export async function uploadImage(
  localUri: string,
  userId: string,
  type: 'profile' | 'car',
  carId?: string,
): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('[IMAGE_UPLOAD] Supabase not configured, skipping upload');
    return null;
  }

  if (isRemoteUrl(localUri)) {
    console.log('[IMAGE_UPLOAD] Already a remote URL, skipping upload:', localUri.substring(0, 60));
    return localUri;
  }

  if (!isLocalFileUri(localUri)) {
    console.log('[IMAGE_UPLOAD] Not a valid local URI, skipping:', localUri.substring(0, 60));
    return null;
  }

  try {
    const timestamp = Date.now();
    const ext = 'jpg';
    const fileName = type === 'car' && carId
      ? `${userId}/cars/${carId}_${timestamp}.${ext}`
      : `${userId}/${type}_${timestamp}.${ext}`;

    console.log('[IMAGE_UPLOAD] Uploading', type, 'image for user', userId);

    let body: any;
    let contentType = 'image/jpeg';

    if (Platform.OS === 'web') {
      const response = await fetch(localUri);
      const blob = await response.blob();
      body = blob;
      contentType = blob.type || 'image/jpeg';
    } else {
      const response = await fetch(localUri);
      const blob = await response.blob();
      body = blob;
    }

    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${fileName}`;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[IMAGE_UPLOAD] Upload failed:', uploadResponse.status, errorText);
      return null;
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${fileName}`;
    console.log('[IMAGE_UPLOAD] Upload successful:', publicUrl.substring(0, 80));
    return publicUrl;
  } catch (error) {
    console.error('[IMAGE_UPLOAD] Error uploading image:', error);
    return null;
  }
}

export async function uploadProfilePicture(localUri: string, userId: string): Promise<string | null> {
  return uploadImage(localUri, userId, 'profile');
}

export async function uploadCarPicture(localUri: string, userId: string, carId: string): Promise<string | null> {
  return uploadImage(localUri, userId, 'car', carId);
}

export async function uploadPostImage(localUri: string, userId: string, postId: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('[IMAGE_UPLOAD] Supabase not configured, skipping upload');
    return null;
  }

  if (isRemoteUrl(localUri)) {
    return localUri;
  }

  if (!isLocalFileUri(localUri)) {
    return null;
  }

  try {
    const timestamp = Date.now();
    const fileName = `${userId}/posts/${postId}_${timestamp}.jpg`;

    console.log('[IMAGE_UPLOAD] Uploading post image for user', userId);

    const response = await fetch(localUri);
    const blob = await response.blob();
    const contentType = Platform.OS === 'web' ? (blob.type || 'image/jpeg') : 'image/jpeg';

    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${fileName}`;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: blob,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[IMAGE_UPLOAD] Post image upload failed:', uploadResponse.status, errorText);
      return null;
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${fileName}`;
    console.log('[IMAGE_UPLOAD] Post image uploaded:', publicUrl.substring(0, 80));
    return publicUrl;
  } catch (error) {
    console.error('[IMAGE_UPLOAD] Error uploading post image:', error);
    return null;
  }
}
