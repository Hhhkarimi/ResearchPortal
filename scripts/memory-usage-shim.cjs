/* CI sandbox compatibility: some restricted kernels deny libuv RSS reads. */
const original=process.memoryUsage.bind(process);
function safeMemoryUsage(){try{return original()}catch{return{rss:0,heapTotal:0,heapUsed:0,external:0,arrayBuffers:0}}}
safeMemoryUsage.rss=()=>{try{return original.rss()}catch{return 0}};
Object.defineProperty(process,"memoryUsage",{value:safeMemoryUsage});
const os=require("node:os");const originalInterfaces=os.networkInterfaces;
os.networkInterfaces=()=>{try{return originalInterfaces()}catch{return{}}};
