import React, { useState, useEffect, useRef } from 'react';
import { auth, db, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc, storage, ref as storageRef, deleteObject, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, formatTimestamp } from '../../firebase';

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

type CommentType = {
    id: string;
    userId: string;
    username: string;
    text: string;
    timestamp: { seconds: number; nanoseconds: number };
}

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
  onPostDeleted: (postId: string) => void;
}

const Post: React.FC<PostProps> = ({ post, onPostDeleted }) => {
  const currentUser = auth.currentUser;
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes.length);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCommentDeleteConfirmOpen, setIsCommentDeleteConfirmOpen] = useState(false);
  const [commentToDeleteId, setCommentToDeleteId] = useState<string | null>(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);


  useEffect(() => {
    if (currentUser) {
        setIsLiked(post.likes.includes(currentUser.uid));
    }
  }, [post.likes, currentUser]);

  useEffect(() => {
    const commentsRef = collection(db, 'posts', post.id, 'comments');
    const q = query(commentsRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommentType)));
    });

    return () => unsubscribe();
  }, [post.id]);
  
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

  const handleDelete = async () => {
    if (currentUser?.uid !== post.userId) return;

    setIsDeleting(true);
    try {
        // Firebase Storage URLs are in the format:
        // https://firebasestorage.googleapis.com/v0/b/YOUR_BUCKET/o/path%2Fto%2Fyour%2Ffile.jpg?alt=media&token=...
        // We need to extract the path from this URL.
        const imagePath = decodeURIComponent(post.imageUrl.split('/o/')[1].split('?')[0]);
        const imageRef = storageRef(storage, imagePath);
        const postRef = doc(db, 'posts', post.id);

        await deleteDoc(postRef);
        await deleteObject(imageRef);
        
        onPostDeleted(post.id);

    } catch (error) {
        console.error("Error deleting post:", error);
    } finally {
        setIsDeleting(false);
        setIsDeleteConfirmOpen(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser || newComment.trim() === '') return;

    const commentsRef = collection(db, 'posts', post.id, 'comments');
    try {
        await addDoc(commentsRef, {
            text: newComment.trim(),
            userId: currentUser.uid,
            username: currentUser.displayName,
            timestamp: serverTimestamp()
        });
        setNewComment('');
    } catch (error) {
        console.error("Error adding comment: ", error);
    }
  };
  
  const confirmDeleteComment = async () => {
    if (!commentToDeleteId) return;

    setIsDeletingComment(true);
    try {
        const commentRef = doc(db, 'posts', post.id, 'comments', commentToDeleteId);
        await deleteDoc(commentRef);
        // onSnapshot will handle UI update
        setIsCommentDeleteConfirmOpen(false);
        setCommentToDeleteId(null);
    } catch (error) {
        console.error("Error deleting comment:", error);
    } finally {
        setIsDeletingComment(false);
    }
  };


  return (
    <>
        <article className="bg-white dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-lg">
        <div className="flex items-center p-3">
            <img src={post.userAvatar} alt={post.username} className="w-8 h-8 rounded-full object-cover" />
            <span className="font-semibold text-sm ml-3">{post.username}</span>
            {currentUser?.uid === post.userId && (
                 <div className="ml-auto relative">
                    <button onClick={() => setIsOptionsOpen(prev => !prev)}>
                        <MoreIcon className="w-6 h-6" />
                    </button>
                    {isOptionsOpen && (
                         <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-zinc-950 rounded-md shadow-lg border dark:border-zinc-800 z-10 py-1">
                            <button 
                                onClick={() => {
                                    setIsDeleteConfirmOpen(true);
                                    setIsOptionsOpen(false);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            >
                                Delete
                            </button>
                        </div>
                    )}
                 </div>
            )}
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
            <div className="text-sm space-y-1">
                <p>
                    <span className="font-semibold mr-2">{post.username}</span>
                    {post.caption}
                </p>
                 {comments.slice(0, 2).reverse().map(comment => (
                    <div key={comment.id} className="flex items-center justify-between group">
                         <p className="flex-grow pr-2">
                             <span className="font-semibold mr-2">{comment.username}</span>
                             {comment.text}
                         </p>
                         {(currentUser?.uid === comment.userId || currentUser?.uid === post.userId) && (
                              <button 
                                 onClick={() => {
                                     setCommentToDeleteId(comment.id);
                                     setIsCommentDeleteConfirmOpen(true);
                                 }}
                                 className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                 aria-label="Delete comment"
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-500 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                             </button>
                         )}
                     </div>
                ))}
            </div>
            {comments.length > 2 && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                    View all {comments.length} comments
                </p>
            )}
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase mt-2">{formatTimestamp(post.timestamp)}</p>
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-2">
            <form onSubmit={handleCommentSubmit} className="flex items-center">
                <input 
                  type="text" 
                  placeholder="Add a comment..." 
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full bg-transparent border-none focus:outline-none text-sm placeholder:text-zinc-500 dark:placeholder:text-zinc-400" />
                <button 
                  type="submit" 
                  className="text-sky-500 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed" 
                  disabled={!newComment.trim()}
                >
                    Post
                </button>
            </form>
        </div>
        </article>

        {isCommentDeleteConfirmOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                <div className="bg-white dark:bg-black rounded-lg shadow-xl p-6 w-full max-w-sm text-center border dark:border-zinc-800">
                    <h3 className="text-lg font-semibold mb-2">Delete Comment?</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                        Are you sure you want to delete this comment?
                    </p>
                    <div className="flex flex-col gap-2">
                         <button 
                            onClick={confirmDeleteComment}
                            disabled={isDeletingComment}
                            className="w-full px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold disabled:opacity-50"
                        >
                            {isDeletingComment ? 'Deleting...' : 'Delete'}
                        </button>
                        <button 
                            onClick={() => setIsCommentDeleteConfirmOpen(false)}
                            className="w-full px-4 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}

        {isDeleteConfirmOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                <div className="bg-white dark:bg-black rounded-lg shadow-xl p-6 w-full max-w-sm text-center border dark:border-zinc-800">
                    <h3 className="text-lg font-semibold mb-2">Delete Post?</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                        Are you sure you want to delete this post?
                    </p>
                    <div className="flex flex-col gap-2">
                         <button 
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="w-full px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold disabled:opacity-50"
                        >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                        <button 
                            onClick={() => setIsDeleteConfirmOpen(false)}
                            className="w-full px-4 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

export default Post;