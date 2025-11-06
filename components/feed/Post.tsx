import React, { useState, useEffect } from 'react';
import { auth, db, doc, updateDoc, arrayUnion, arrayRemove } from '../../firebase';

type PostType = {
    id: string;
    userId: string;
    username: string;
    userAvatar: string;
    imageUrl: string;
    caption: string;
    likes: string[];
    timestamp: { seconds: number; nanoseconds: number };
};

const formatTimestamp = (timestamp: { seconds: number; nanoseconds: number } | null | undefined): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
};


const LikeIcon: React.FC<{className?: string, isLiked: boolean}> = ({ className, isLiked }) => (
  <svg aria-label="Like" className={className} fill={isLiked ? '#ef4444' : 'currentColor'} height="24" role="img" viewBox="0 0 24 24" width="24"><title>Like</title><path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-6.12 8.351C12.89 20.72 12.434 21 12 21s-.89-.28-1.38-.627C7.152 14.08 4.5 12.192 4.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.118-1.763a4.21 4.21 0 0 1 3.675-1.941Z"></path></svg>
);

const CommentIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg aria-label="Comment" className={className} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Comment</title><path d="M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></path></svg>
);

const ShareIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg aria-label="Share Post" className={className} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Share Post</title><line fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" x1="22" x2="9.218" y1="3" y2="10.083"></line><polygon fill="none" points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></polygon></svg>
);

const SaveIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg aria-label="Save" className={className} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Save</title><polygon fill="none" points="20 21 12 13.44 4 21 4 3 20 3 20 21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></polygon></svg>
);

const MoreIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg aria-label="More options" className={className} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>More options</title><circle cx="12" cy="12" r="1.5"></circle><circle cx="6" cy="12" r="1.5"></circle><circle cx="18" cy="12" r="1.5"></circle></svg>
);


interface PostProps {
  post: PostType;
}

const Post: React.FC<PostProps> = ({ post }) => {
  const currentUser = auth.currentUser;
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes.length);

  useEffect(() => {
    if (currentUser) {
        setIsLiked(post.likes.includes(currentUser.uid));
    }
  }, [post.likes, currentUser]);
  
  const handleLikeToggle = async () => {
    if (!currentUser) return;
    
    const postRef = doc(db, 'posts', post.id);
    const originalIsLiked = isLiked;
    const originalLikesCount = likesCount;

    // Optimistic update
    setIsLiked(!originalIsLiked);
    setLikesCount(originalIsLiked ? originalLikesCount - 1 : originalLikesCount + 1);

    try {
        if (originalIsLiked) {
            await updateDoc(postRef, { likes: arrayRemove(currentUser.uid) });
        } else {
            await updateDoc(postRef, { likes: arrayUnion(currentUser.uid) });
        }
    } catch (error) {
        console.error("Error toggling like:", error);
        // Revert on error
        setIsLiked(originalIsLiked);
        setLikesCount(originalLikesCount);
    }
  };

  return (
    <article className="bg-white dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-lg">
      <div className="flex items-center p-3">
        <img src={post.userAvatar} alt={post.username} className="w-8 h-8 rounded-full object-cover" />
        <span className="font-semibold text-sm ml-3">{post.username}</span>
        <button className="ml-auto">
          <MoreIcon className="w-6 h-6" />
        </button>
      </div>
      
      <div>
        <img src={post.imageUrl} alt="Post content" className="w-full object-cover" />
      </div>

      <div className="p-4">
        <div className="flex items-center gap-4 mb-2">
            <button onClick={handleLikeToggle}>
                <LikeIcon className={`w-6 h-6 hover:opacity-70 transition-opacity ${isLiked ? 'text-red-500' : 'dark:text-white'}`} isLiked={isLiked} />
            </button>
            <button>
                <CommentIcon className="w-6 h-6 hover:text-zinc-500 dark:hover:text-zinc-400" />
            </button>
            <button>
                <ShareIcon className="w-6 h-6 hover:text-zinc-500 dark:hover:text-zinc-400" />
            </button>
            <button className="ml-auto">
                <SaveIcon className="w-6 h-6 hover:text-zinc-500 dark:hover:text-zinc-400" />
            </button>
        </div>
        <p className="font-semibold text-sm mb-1">{likesCount.toLocaleString()} likes</p>
        <p className="text-sm">
            <span className="font-semibold mr-2">{post.username}</span>
            {post.caption}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase mt-2">{formatTimestamp(post.timestamp)}</p>
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-2">
        <form className="flex items-center">
            <input type="text" placeholder="Add a comment..." className="w-full bg-transparent border-none focus:outline-none text-sm placeholder:text-zinc-500 dark:placeholder:text-zinc-400" />
            <button type="submit" className="text-sky-500 font-semibold text-sm opacity-50 cursor-not-allowed" disabled>Post</button>
        </form>
      </div>
    </article>
  );
};

export default Post;
