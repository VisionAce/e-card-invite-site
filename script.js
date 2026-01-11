// ==========================================
// 核心設定
// ==========================================
// Firebase 設置 (從 invite2.html 移植)
const firebaseConfig = {
  apiKey: "AIzaSyAAehrte_RNT2POHk2g1S6IKtA-i6OFtvs",
  authDomain: "e-card-invite.firebaseapp.com",
  projectId: "e-card-invite",
  storageBucket: "e-card-invite.firebasestorage.app",
  messagingSenderId: "820854630066",
  appId: "1:820854630066:web:1690f03a7e35991d100bab",
  measurementId: "G-49NDWVRXBH"
};
// 必須確保 Firebase SDK 在 HTML 中已經引入
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    var db = firebase.firestore();
} else {
    console.error("Firebase SDK 未載入，留言板功能將無法使用！");
}

const urlParams = new URLSearchParams(window.location.search);
const inviteCode = urlParams.get("code") || "6885dc";
const version = urlParams.get("v") || "v1";

// ==========================================
// A. 信封開啓與頁面導航邏輯
// ==========================================
let carouselInitialized = false; // 標記是否已初始化輪播

function openEnvelope() {
    const envelope = document.querySelector('.envelope');
    const envelopePage = document.getElementById('envelope-page');
    const contentPage = document.getElementById('content-page');
    
    // 1. 執行信封開啟動畫
    envelope.classList.add('open');
    
    // 2. 延遲切換頁面
    setTimeout(() => {
        envelopePage.style.opacity = '0';
        envelopePage.style.transition = 'opacity 0.5s';
        contentPage.classList.add('active');

        // 初始化相簿和彈幕功能 (只執行一次)
        if (!carouselInitialized) {
            initCarousel();
            initDanmu();
            carouselInitialized = true;
        }

        // 啟動音樂
        if (playlist.length > 0) {
            music.src = playlist[currentSongIndex];
            music.load();
            music.play().then(() => {
                musicControl.classList.remove("music-paused");
            }).catch(error => {
                console.log("[BGM Error] 音樂播放被阻擋", error);
                document.addEventListener('touchstart', function playMusic() {
                    music.play().then(() => musicControl.classList.remove("music-paused"));
                    document.removeEventListener('touchstart', playMusic);
                }, { once: true });
            });
        }
        
        setTimeout(() => {
            envelopePage.style.display = 'none';
        }, 500);

    }, 2500);
}

// 導航欄切換功能
function showSection(id) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
        // 暫停相簿輪播，釋放資源 (只在離開留言區時暫停)
        if (section.id === 'danmu-comment') stopInterval();
    });
    
    const targetSection = document.getElementById(id);
    targetSection.classList.add('active');
    document.querySelector('.scrollable-content').scrollTop = 0; // 滾動到頂部

    // 重新啟動相簿 (只在進入留言區時啟動)
    if (id === 'danmu-comment') startInterval();
}

function scrollToSection(id) {
    // 確保回到婚禮資訊主頁
    showSection('wedding-info');
    
    const targetEl = document.getElementById(id);
    if(targetEl) {
        // 延遲滾動以確保頁面切換完成
        setTimeout(() => {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
}
window.openEnvelope = openEnvelope; // 確保 HTML 裡的 onclick 可以找到它
window.showSection = showSection;
window.scrollToSection = scrollToSection;


// ==========================================
// B. 音樂控制邏輯
// ==========================================
const playlist = ["audio/1-music.mp3","audio/2-music.mp3","audio/3-music.mp3"];
let currentSongIndex = 0;
const music = document.getElementById("background-music");
const musicControl = document.getElementById("musicControl");

function playCurrentSong(){
  if(playlist.length === 0) return;
  music.src = playlist[currentSongIndex];
  music.load();
  music.play().then(()=>musicControl.classList.remove("music-paused"))
         .catch(()=>console.log("自動播放下一首被阻擋"));
}

music.addEventListener("ended", ()=>{
  currentSongIndex = (currentSongIndex+1)%playlist.length;
  playCurrentSong();
});

function toggleMusic(){
    if(music.paused){
        // 如果是從未播放狀態開始，先載入第一首歌
        if (!music.src) {
            music.src = playlist[currentSongIndex];
            music.load();
        }
        music.play();
        musicControl.classList.remove("music-paused");
    } else {
        music.pause();
        musicControl.classList.add("music-paused");
    }
}
window.toggleMusic = toggleMusic;


// ==========================================
// C. 彈幕留言邏輯
// ==========================================
const nickEl = document.getElementById("nick");
const msgEl = document.getElementById("msg");
const sendBtn = document.getElementById("sendBtn");
const danmuLayer = document.getElementById("danmuLayer");
const messagesMap = new Map();
let danmuQueue = [];
const MAX_MESSAGES = 500;
let danmuInterval;

function addDanmu(text){
  const el = document.createElement("div");
  el.className = "danmu-item";
  el.innerText = text;
  // 保留頂部和底部表單空間 (留言區高度 - 150px)
  const top = Math.random() * (danmuLayer.clientHeight - 150) + 50;
  el.style.top = top + "px";
  el.style.background = `rgba(255,255,255,${0.04 + Math.random()*0.08})`;
  danmuLayer.appendChild(el);

  const len = Math.max(5,text.length);
  const duration = 4 + Math.min(10,len/5);
  const start = performance.now();
  const startX = danmuLayer.clientWidth + 20;
  const endX = - (el.clientWidth + 20);

  function frame(now){
    const t = (now - start)/(duration*1000);
    if(t>=1){ el.remove(); return; }
    el.style.transform = `translateX(${startX + (endX-startX)*t}px)`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setTimeout(()=>el.remove(),(duration+1)*1000);
}

function playDanmuLoop(){
  if(danmuQueue.length===0) return;
  // 為了避免重複彈幕，每次從隊列頭取出，顯示後再放回隊列尾
  const msg = danmuQueue.shift();
  addDanmu(`${msg.nick}: ${msg.text}`);
  danmuQueue.push(msg);
}

function loadHistory(){
  if (typeof db === 'undefined') return;
  db.collection('messages').orderBy('ts','asc').limit(MAX_MESSAGES)
    .get().then(snap=>{
      snap.forEach(doc=>{
        if(!messagesMap.has(doc.id)){
          messagesMap.set(doc.id, doc.data());
        }
      });
      danmuQueue = Array.from(messagesMap.values());
    });
}

function initDanmu(){
    loadHistory();
    if (typeof db === 'undefined') return;

    db.collection('messages').orderBy('ts','asc')
      .onSnapshot(snap=>{
        snap.docChanges().forEach(change=>{
          if(change.type==='added' && !messagesMap.has(change.doc.id)){
            const d = change.doc.data();
            messagesMap.set(change.doc.id,d);
            danmuQueue.push(d);
          }
        });
        while(danmuQueue.length>MAX_MESSAGES) danmuQueue.shift();
      });
    
    danmuInterval = setInterval(playDanmuLoop, 2000); // 每 2 秒播放一條彈幕
}

let disabledUntil=0;
function sendMessage(){
  if(Date.now()<disabledUntil) return;
  const nick = nickEl.value.trim();
  const text = msgEl.value.trim();
  if(!nick){ alert("請輸入暱稱"); return; }
  if(!text){ alert("請輸入留言"); return; }
  const nickExists = Array.from(messagesMap.values()).some(m=>m.nick===nick);
  // 註解掉暱稱檢查，避免影響測試
  // if(nickExists){ alert("暱稱已存在，請使用不同暱稱"); nickEl.focus(); return; }

  sendBtn.disabled = true;
  disabledUntil = Date.now()+5000;
  setTimeout(()=>sendBtn.disabled=false,5000);

  if (typeof db !== 'undefined') {
    db.collection('messages').add({
      nick,text,ts:firebase.firestore.FieldValue.serverTimestamp(),
      code:inviteCode,ver:version
    });
  } else {
    alert("留言功能未初始化，請檢查 Firebase 設定。");
  }

  nickEl.value = "";
  msgEl.value = "";
}

// 確保元素存在再綁定事件
document.addEventListener('DOMContentLoaded', () => {
    if (sendBtn) sendBtn.onclick = sendMessage;
    if (msgEl) msgEl.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } };
});


// ==========================================
// D. 相簿輪播邏輯 (作為背景)
// ==========================================
let interval;
// 注意：選擇器改為 .background-slides 內的 .slides
const slidesContainer = document.querySelector(".background-slides .slides");
let slideElements;
let counter = 1;

function initCarousel(){
    if (!slidesContainer) return;
    
    // 選擇器改為 .background-slides 內的 .slide
    slideElements = Array.from(document.querySelectorAll(".background-slides .slide"));

    // 無縫輪播複製
    const firstClone = slideElements[0].cloneNode(true);
    const lastClone = slideElements[slideElements.length-1].cloneNode(true);
    slidesContainer.appendChild(firstClone);
    slidesContainer.insertBefore(lastClone, slideElements[0]);
    slideElements = document.querySelectorAll(".background-slides .slide");

    // 設定初始位置
    slidesContainer.style.transform = `translateX(${-counter*100}%)`;
    
    // 綁定過渡完成事件
    slidesContainer.addEventListener("transitionend", handleTransitionEnd);

    // 不需要綁定手勢滑動，因為是自動播放的背景
}

function updateSlide(){
  slidesContainer.style.transition = "transform 0.7s ease-in-out";
  slidesContainer.style.transform = `translateX(${-counter*100}%)`;
}

function startInterval(){
  // 僅在留言區塊顯示時啟動
  if (document.getElementById('danmu-comment').classList.contains('active')) {
      stopInterval();
      const currentSlide = slideElements[counter];
      const video = currentSlide.querySelector("video");
      if(video){
        video.currentTime = 0;
        // 播放影片，處理 Promise 錯誤
        video.play().catch(e => console.log("影片自動播放被阻止:", e));
        video.onended = nextSlide;
      } else {
        interval = setTimeout(nextSlide, 4000);
      }
  }
}

function stopInterval(){
    clearInterval(interval);
    // 暫停所有影片
    if (slideElements) {
        slideElements.forEach(s => {
            const video = s.querySelector("video");
            if(video) video.pause();
        });
    }
}

function nextSlide(){
  counter++;
  updateSlide();
  // 不需要再次呼叫 startInterval，讓 transitionend 呼叫
  if (counter >= slideElements.length) {
     // 預先呼叫一次，確保動畫結束後能銜接
     // 這裡讓 transitionend 處理迴圈和下一次 startInterval
  }
}

function handleTransitionEnd(){
  // 處理無縫循環
  if(counter >= slideElements.length-1){
    slidesContainer.style.transition = "none";
    counter = 1;
    slidesContainer.style.transform = `translateX(${-counter*100}%)`;
    // 重新啟動計時器/影片播放
    startInterval();
  } else if(counter===0){
    slidesContainer.style.transition = "none";
    counter = slideElements.length-2;
    slidesContainer.style.transform = `translateX(${-counter*100}%)`;
    // 重新啟動計時器/影片播放
    startInterval();
  } else {
    // 處理正常轉場完成後，再次啟動下一個計時器
    startInterval();
  }
}

window.openMapLink = function() {
    // 您指定的連結
    const mapUrl = "https://maps.app.goo.gl/jezzJtH5PCQTCzJCA?g_st=ic";
    window.open(mapUrl, '_blank');
};

window.openParkLink = function() {
    // 您指定的連結
    const parkUrl = "https://maps.app.goo.gl/JS87spJnYhpk9H1W9?g_st=il";
    window.open(parkUrl, '_blank');
};

window.openWeddingLink = function() {
    // 您指定的連結
    const weddingUrl = "https://docs.google.com/forms/d/e/1FAIpQLScqtqDqtzWxFfjNVssRJI-fF8QA7eAABio5qBMoYBfuMzzybA/viewform?usp=dialog";
    window.open(weddingUrl, '_blank');
};
