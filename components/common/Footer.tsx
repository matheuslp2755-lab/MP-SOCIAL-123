import React from 'react';

const Footer: React.FC = () => {
    
    const footerLinks = [
        { key: 'meta', name: 'Meta' },
        { key: 'about', name: 'About' },
        { key: 'blog', name: 'Blog' },
        { key: 'jobs', name: 'Jobs' },
        { key: 'help', name: 'Help' },
        { key: 'api', name: 'API' },
        { key: 'privacy', name: 'Privacy' },
        { key: 'terms', name: 'Terms' },
        { key: 'locations', name: 'Locations' },
        { key: 'lite', name: 'Instagram Lite' },
        { key: 'threads', name: 'Threads' },
        { key: 'contact', name: 'Contact Uploading & Non-Users' },
        { key: 'verified', name: 'Meta Verified' },
    ];

  return (
    <footer className="text-zinc-500 dark:text-zinc-400 text-xs px-4 pb-4">
      <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 mb-4">
        {footerLinks.map(link => (
          <a key={link.key} href="#" className="hover:underline">
            {link.name}
          </a>
        ))}
      </div>
      <div className="flex justify-center items-center gap-4">
        <span>English</span>
        <span>{`© ${new Date().getFullYear()} MP SOCIAL from Meta`}</span>
      </div>
    </footer>
  );
};

export default Footer;
