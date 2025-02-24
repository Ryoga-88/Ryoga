// "use client";

// import React, { useState, useMemo, useEffect } from "react";
// import ImageGallery from "react-image-gallery";
// import "react-image-gallery/styles/css/image-gallery.css";
// import { FaXmark } from "react-icons/fa6";
// import { useCategory } from "app/components/category";

// export default function PhotoList({ posts }) {
//   const {
//     selectedCategory,
//     categories,
//     categoryCounts,
//     selectCategory,
//     filteredPosts,
//   } = useCategory(posts);

//   const [isGalleryOpen, setIsGalleryOpen] = useState(false);
//   const [currentIndex, setCurrentIndex] = useState(0);

//   const images = useMemo(() => {
//     return posts
//       .filter(
//         (post) =>
//           selectedCategory === "all" || post.category === selectedCategory
//       )
//       .map((post) => ({
//         original: `${post.url}/thumb/3000`,
//         thumbnail: `${post.url}/thumb/500`,
//         description: post.title,
//       }));
//   }, [filteredPosts]);

//   useEffect(() => {
//     if (!isGalleryOpen) {
//       images.forEach((image) => {
//         const img = new Image();
//         img.src = image.original;
//       });
//     }
//   }, [images, isGalleryOpen]);

//   return (
//     <div className="container mx-auto px-2 py-6">
//       <div className="overflow-x-auto whitespace-nowrap space-x-8 flex justify-start md:justify-center items-center px-2 py-2 text-neutral-400 dark:text-white">
//         <button
//           onClick={() => selectCategory("all")}
//           className={`hover:text-neutral-500 ${
//             selectedCategory === "all" ? "underline" : ""
//           }`}
//         >
//           すべて ({posts.length})
//         </button>
//         {categories.map((category) => (
//           <button
//             key={category}
//             onClick={() => selectCategory(category)}
//             className={`hover:text-neutral-500 ${
//               selectedCategory === category ? "underline" : ""
//             }`}
//           >
//             {categoryEmojis[category] || "📚"} {category} (
//             {categoryCounts[category]})
//           </button>
//         ))}
//       </div>
//       {!isGalleryOpen ? (
//         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
//           {images.map((image, index) => (
//             <div key={index} className="aspect-square overflow-hidden">
//               <img
//                 src={image.thumbnail}
//                 alt={image.description}
//                 className="object-cover w-full h-full cursor-pointer"
//                 onClick={() => {
//                   setCurrentIndex(index);
//                   setIsGalleryOpen(true);
//                 }}
//               />
//             </div>
//           ))}
//         </div>
//       ) : (
//         <div className="relative">
//           <FaXmark
//             onClick={() => setIsGalleryOpen(false)}
//             className="absolute top-1 right-1 m-2 z-10 p-2 text-white bg-slate-800 bg-opacity-50 rounded-full cursor-pointer"
//             style={{ fontSize: "2rem" }}
//           />
//           <ImageGallery
//             items={images}
//             startIndex={currentIndex}
//             showThumbnails={true}
//             showFullscreenButton={false}
//             showPlayButton={false}
//             lazyLoad={true}
//           />
//         </div>
//       )}
//     </div>
//   );
// }

// const categoryEmojis = {
//   Turkey: (
//     <img
//       src="/images/Turkey-flag.svg"
//       alt="Turkey Flag"
//       className="inline-block w-4 h-4 mr-1"
//     />
//   ),
//   India: (
//     <img
//       src="/images/India-flag.svg"
//       alt="India Flag"
//       className="inline-block w-4 h-4 mr-1"
//     />
//   ),
//   Vietnam: (
//     <img
//       src="/images/Vietnam-flag.svg"
//       alt="Vietnam Flag"
//       className="inline-block w-4 h-4 mr-1"
//     />
//   ),
//   Cambodia: (
//     <img
//       src="/images/Cambodia-flag.svg"
//       alt="Cambodia Flag"
//       className="inline-block w-4 h-4 mr-1"
//     />
//   ),
//   Thailand: (
//     <img
//       src="/images/Thailand-flag.svg"
//       alt="Thailand Flag"
//       className="inline-block w-4 h-4 mr-1"
//     />
//   ),
//   Singapore: (
//     <img
//       src="/images/Singapore-flag.svg"
//       alt="Singapore Flag"
//       className="inline-block w-4 h-4 mr-1"
//     />
//   ),
//   Malaysia: (
//     <img
//       src="/images/Malaysia-flag.svg"
//       alt="Malaysia Flag"
//       className="inline-block w-4 h-4 mr-1"
//     />
//   ),
// };
