const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const postsDirectory = path.join(process.cwd(), "app", "contents", "blogs");
const jsFilePath = path.join(process.cwd(), "app", "contents", "blogs.js");

function updateBlogsJs() {
  try {
    const filenames = fs.readdirSync(postsDirectory);

    const posts = filenames
      .filter((filename) => filename.endsWith(".md"))
      .map((filename) => {
        const filePath = path.join(postsDirectory, filename);
        const fileContents = fs.readFileSync(filePath, "utf8");
        const { data } = matter(fileContents);

        const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.ja\.md$/);
        const date = dateMatch ? dateMatch[1] : null;
        const slug = dateMatch
          ? dateMatch[2]
          : filename.replace(/\.ja\.md$/, "");

        return {
          slug,
          date,
          title: data.title,
          category: data.category,
          keywords: data.keywords || [],
        };
      });

    const jsContent = `module.exports = ${JSON.stringify(posts, null, 2)};`;
    fs.writeFileSync(jsFilePath, jsContent);
    console.log("JS file updated successfully.");
  } catch (error) {
    console.error("Error during JS update:", error);
  }
}

updateBlogsJs();
