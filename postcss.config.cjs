module.exports = {
  plugins: {
    autoprefixer: {
      // Obsidian 1.0.0
      overrideBrowserslist: ['Electron >= 21', 'iOS >= 14.5', 'Android >= 5.1'],
    },
  },
};
