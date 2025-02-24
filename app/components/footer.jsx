import Logo from "./logo";
// import { BsTwitterX } from "react-icons/bs";
// import { FaFacebook } from "react-icons/fa";
// import { FaInstagram } from "react-icons/fa6";
import { MdOutlineCopyright } from "react-icons/md";
import Link from "next/link";

function Footer() {
  return (
    <footer className="w-full dark:bg-black py-4 mt-auto">
      <div className="flex items-center justify-center">
        <div className="flex items-center text-neutral-800 dark:text-white">
          <MdOutlineCopyright />
          2024 &nbsp;
          <Logo />
          &nbsp;|&nbsp;
          <Link
            href="/privacy"
            className="text-base underline text-neutral-400 dark:text-white"
          >
            Privacy Policy
          </Link>
        </div>
        {/* <div className="flex items-center space-x-4">
          <a href="https://twitter.com/PmykLLr6tJIrksA">
            <BsTwitterX />
          </a>
          <a
            href="https://www.facebook.com/profile.php?id=100091760178719&locale=ja_JP"
            className="text-blue-600 text-xl"
          >
            <FaFacebook />
          </a>
          <a
            href="https://www.instagram.com/"
            className="text-pink-500 text-xl"
          >
            <FaInstagram />
          </a>
        </div> */}
      </div>
    </footer>
  );
}

export default Footer;
