import React, { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db, setDoc, doc, storage, storageRef, uploadBytes, getDownloadURL, serverTimestamp } from '../firebase';
import TextInput from '../components/common/TextInput';
import Button from '../components/common/Button';

const AppLogo: React.FC = () => {
    return (
      <h1 className="text-4xl font-serif text-center mb-6">
        MP SOCIAL
      </h1>
    );
};

const AppStoreButton: React.FC = () => (
    <a href="#" className="inline-block">
        <img src="https://www.instagram.com/static/images/appstore-install-badges/badge_ios_english-en.png/180ae7a0bcf7.png" alt="Download on the App Store" className="h-10"/>
    </a>
);

const GooglePlayButton: React.FC = () => (
    <a href="#" className="inline-block">
        <img src="https://www.instagram.com/static/images/appstore-install-badges/badge_android_english-en.png/e9cd846dc748.png" alt="Get it on Google Play" className="h-10"/>
    </a>
);

interface SignUpProps {
  onSwitchMode: () => void;
}

const SignUp: React.FC<SignUpProps> = ({ onSwitchMode }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isFormValid = email.includes('@') && username.trim() !== '' && password.trim().length >= 6;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setError('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Generate and upload a default SVG avatar
      const initial = username.charAt(0).toUpperCase();
      const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722', '#795548', '#607d8b'];
      const color = colors[initial.charCodeAt(0) % colors.length];
      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="100%" height="100%" fill="${color}" /><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="75" fill="#ffffff">${initial}</text></svg>`;
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
      
      const avatarRef = storageRef(storage, `avatars/${userCredential.user.uid}/avatar.svg`);
      await uploadBytes(avatarRef, svgBlob);
      const avatarUrl = await getDownloadURL(avatarRef);

      // Update user profile in auth
      await updateProfile(userCredential.user, {
        displayName: username,
        photoURL: avatarUrl,
      });

      // Create user document in Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        username: username,
        username_lowercase: username.toLowerCase(),
        email: email,
        avatar: avatarUrl,
        bio: '',
        isPrivate: false,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp()
      });

      // Auth state change will be handled by App.tsx
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError("This email is already in use.");
      } else {
        setError("Failed to create an account. Please try again.");
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-lg p-10 mb-2.5">
            <AppLogo />
            <h2 className="text-zinc-500 dark:text-zinc-400 font-semibold text-center mb-6">
                Sign up to see photos and videos from your friends.
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                <TextInput
                    id="email"
                    type="email"
                    label="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <TextInput
                    id="username"
                    type="text"
                    label="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                <TextInput
                    id="password"
                    type="password"
                    label="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                {error && <p className="text-red-500 text-xs text-center mt-2">{error}</p>}
                <Button type="submit" disabled={!isFormValid || loading} className="mt-4">
                    {loading ? "Signing Up..." : "Sign Up"}
                </Button>
            </form>
        </div>
        
        <div className="bg-white dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-lg p-6 text-center text-sm">
            <p>
                Have an account?{' '}
                <button
                    onClick={onSwitchMode}
                    className="font-semibold text-sky-500 hover:text-sky-600 bg-transparent border-none p-0 cursor-pointer"
                >
                    Log in
                </button>
            </p>
        </div>

        <div className="text-center mt-4 text-sm">
            <p className="mb-4">Get the app.</p>
            <div className="flex justify-center gap-4">
                <AppStoreButton />
                <GooglePlayButton />
            </div>
        </div>
    </div>
  );
};

export default SignUp;