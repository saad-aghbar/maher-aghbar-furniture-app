declare module 'fontkit' {
  const fontkit: {
    openSync: (filename: string, postscriptName?: string) => unknown;
  };
  export default fontkit;
}
