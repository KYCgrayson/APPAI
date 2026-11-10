export const languages = { en: 'English', es: 'Español', 'zh-TW': '繁體中文', 'zh-CN': '简体中文', ja: '日本語', ko: '한국어', de: 'Deutsch', fr: 'Français', hi: 'हिन्दी' };
// Parallel, complete phrase lists. No language falls back to English.
export const keys = `title about eyebrow intro local online players human computer player settings language theme auto light dark board classic short exact again rules rulesBody finishRule freeRule sixRule start newGame resume home playAgain roll rolling turn winner rolled climbed slid bounced extraTurn position offBoard goal turns boardLabel games roomCode create join waiting waitingHint startRoom joined you copy copied roomHelp roomTrust signIn signInLink unavailable invalid_code room_not_found room_full room_not_ready not_your_turn version_conflict invalid_state history_gap rate_limited room_finished already_started not_host invalid_request storageWarning random_unavailable zoom zoomOut journey seatWaiting seatReady skip idleHint expireHint finishHint ladder snake computerThinking roomResume pause`.split(' ');
const phrases = {
en: `Snakes and Ladders
A traditional race from India, originally known as Moksha Patam.
A little journey of ups and downs
One die. A few friendly snakes. A race to the top!
On this device
Room with friends
Players
Human
Computer
Player {n}
Settings
Language
Appearance
Automatic
Light
Dark
Board
Classic · 100 squares
Little steps · 50 squares
Exact roll to finish (bounce back)
Roll a six, roll again
How to play
Start off the board. Take turns rolling and follow the numbers. Climb ladders and slide down snakes. The first to the last square wins!
With exact finish on, a roll past the last square bounces back by the extra steps.
With exact finish off, any roll reaching or passing the last square wins.
With extra turns on, rolling a six gives you another turn.
Let’s play
New game
Resume game
Back to home
Play again
Roll die
Moving…
{player}’s turn
{player} wins!
{player} rolled {roll}: {from} → {to}.
Up the ladder: {from} → {to}!
Down the snake: {from} → {to}!
Bounce back!
Six! Roll again.
Square {n}
Start
Finish · {n}
Rolls: {n}
Numbered game board, from 1 to {n}. Tokens are listed below.
← Games
Room code
Create room
Join room
Waiting for friends
Share the code. The room starts when full, or the host can start with at least two players.
Start with these players
{n} joined
You are {player}
Copy code
Code copied
Each friend uses their own device. Room creation needs AppAI sign-in; joining does not.
Room rolls are trusted: each player’s device rolls its own die.
Sign in to appai.info to create a room. Open this game on appai.info first.
Sign in to AppAI
The room connection is unavailable. Try again.
Enter a valid six-character room code.
This room was not found. Create or join another room.
This room is full.
At least two players must join first.
The turn changed. The board has been refreshed.
The room changed. Review the board and roll again if it is your turn.
We could not validate this room’s moves. Return home and start a new room.
Too many turns were missed to verify this game. Please start a new room.
Please wait a moment before trying again.
This room has finished. Create a new room to play again.
This room has already started.
Only the host can start the room.
That action could not be completed. Please try again.
Saving is unavailable. Keep this page open to keep your game.
Your browser cannot roll securely. Try a newer browser.
Enlarge board
Fit board
Paths on the board
Waiting
Ready
Skip idle player
This player has been away for two minutes. You may skip their turn.
Waiting rooms close two minutes after the latest join.
First to {n} wins
Ladder {from} → {to}
Snake {from} → {to}
Computer is thinking…
Resume room
Pause / home`,
es: `Serpientes y escaleras
Una carrera tradicional de la India, conocida originalmente como Moksha Patam.
Un pequeño viaje de subidas y bajadas
¡Un dado, unas serpientes simpáticas y una carrera hasta la meta!
En este dispositivo
Sala con amigos
Jugadores
Persona
Ordenador
Jugador {n}
Ajustes
Idioma
Aspecto
Automático
Claro
Oscuro
Tablero
Clásico · 100 casillas
Pasitos · 50 casillas
Llegada exacta (rebotar hacia atrás)
Sacar un seis permite repetir
Cómo jugar
Empieza fuera del tablero. Tirad por turnos y seguid los números. Sube escaleras y baja por las serpientes. ¡Gana quien llegue primero a la última casilla!
Con llegada exacta, si te pasas de la última casilla, retrocedes los pasos sobrantes.
Sin llegada exacta, ganas si la tirada alcanza o supera la última casilla.
Si activas repetir turno, sacar un seis te permite tirar otra vez.
¡A jugar!
Nueva partida
Continuar partida
Volver al inicio
Jugar otra vez
Tirar el dado
En movimiento…
Turno de {player}
¡Gana {player}!
{player} sacó {roll}: {from} → {to}.
¡Sube la escalera: {from} → {to}!
¡Baja por la serpiente: {from} → {to}!
¡Rebota hacia atrás!
¡Seis! Tira otra vez.
Casilla {n}
Salida
Meta · {n}
Tiradas: {n}
Tablero numerado del 1 al {n}. Las fichas aparecen debajo.
← Juegos
Código de sala
Crear sala
Entrar en sala
Esperando a tus amigos
Comparte el código. La sala empieza al llenarse, o el anfitrión puede empezar con al menos dos jugadores.
Empezar con estos jugadores
{n} participantes
Eres {player}
Copiar código
Código copiado
Cada amigo usa su dispositivo. Para crear una sala debes iniciar sesión en AppAI; para entrar no hace falta.
Las tiradas se basan en la confianza: cada dispositivo tira su propio dado.
Inicia sesión en appai.info para crear una sala. Abre primero este juego en appai.info.
Iniciar sesión en AppAI
No se puede conectar con la sala. Inténtalo de nuevo.
Escribe un código válido de seis caracteres.
No encontramos esta sala. Crea otra o entra en otra sala.
Esta sala está llena.
Primero deben entrar al menos dos jugadores.
El turno ha cambiado. Hemos actualizado el tablero.
La sala ha cambiado. Revisa el tablero y tira de nuevo si es tu turno.
No pudimos validar las jugadas. Vuelve al inicio y crea otra sala.
Se han perdido demasiados turnos para comprobar la partida. Crea otra sala.
Espera un momento antes de intentarlo de nuevo.
Esta sala ha terminado. Crea otra para volver a jugar.
Esta sala ya ha empezado.
Solo el anfitrión puede empezar la sala.
No se pudo realizar la acción. Inténtalo de nuevo.
No se puede guardar. Mantén esta página abierta para conservar la partida.
Tu navegador no puede tirar de forma segura. Prueba uno más reciente.
Ampliar tablero
Ajustar tablero
Caminos del tablero
Esperando
Listo
Saltar jugador ausente
Este jugador lleva dos minutos ausente. Puedes saltar su turno.
Las salas en espera cierran dos minutos después de la última entrada.
Gana quien llegue primero a {n}
Escalera {from} → {to}
Serpiente {from} → {to}
El ordenador está pensando…
Continuar sala
Pausa / inicio`,
'zh-TW': `蛇梯棋
源自印度的傳統競賽遊戲，原名 Moksha Patam。
一趟有上有下的小旅程
一顆骰子、幾條可愛的蛇，一起向終點出發！
同一台裝置
好友房間
玩家人數
真人
電腦
玩家 {n}
設定
語言
顯示模式
跟隨系統
淺色
深色
棋盤
經典版 · 100 格
小小步 · 50 格
點數剛好才能到終點（超過就往回走）
擲出六點可以再擲一次
玩法
從棋盤外出發，輪流擲骰子，沿數字前進。遇到梯子往上爬，遇到蛇頭往下滑，最先到最後一格就獲勝！
開啟精確抵達時，超過終點的步數要往回走。
關閉精確抵達時，點數足以抵達或超過終點就獲勝。
開啟追加回合時，擲出六點可以再擲一次。
開始玩
新遊戲
繼續遊戲
回到首頁
再玩一次
擲骰子
移動中…
輪到{player}
{player}獲勝！
{player}擲出 {roll} 點：{from} → {to}。
爬梯子：{from} → {to}！
蛇蛇滑梯：{from} → {to}！
往回走！
六點！再擲一次。
第 {n} 格
起點
終點 · {n}
擲骰次數：{n}
從 1 到 {n} 的數字棋盤，下方列出各玩家的棋子位置。
← 遊戲
房間代碼
建立房間
加入房間
等待好友
分享代碼，滿員就會開始；房主也可以在至少兩人加入後開始。
以目前人數開始
已有 {n} 人加入
你是{player}
複製代碼
已複製代碼
好友各用一台裝置。建立房間須登入 AppAI，加入不必登入。
房間採信任制：各玩家的裝置自行擲骰子。
請登入 appai.info 以建立房間，並先在 appai.info 開啟本遊戲。
登入 AppAI
暫時無法連線到房間，請再試一次。
請輸入有效的六位房間代碼。
找不到這個房間，請建立或加入其他房間。
這個房間已滿。
請先等至少兩位玩家加入。
回合已變更，棋盤已更新。
房間已更新，請查看棋盤，若輪到你就再擲一次。
無法驗證房間的步驟，請回首頁建立新房間。
錯過太多回合，無法驗證這局遊戲，請建立新房間。
請稍等一下再試。
這個房間的遊戲已結束，請建立新房間再玩。
這個房間已經開始。
只有房主可以開始遊戲。
無法完成這個操作，請再試一次。
無法儲存，請保持網頁開啟以保留進度。
瀏覽器無法安全擲骰子，請換用較新的瀏覽器。
放大棋盤
棋盤適合螢幕
棋盤上的路線
等待中
已就緒
略過離線玩家
這位玩家已離開兩分鐘，你可以略過他的回合。
等待中的房間會在最後一人加入後兩分鐘關閉。
最先到第 {n} 格獲勝
梯子 {from} → {to}
蛇 {from} → {to}
電腦思考中…
繼續房間
暫停／首頁`,
'zh-CN': `蛇梯棋
源自印度的传统竞赛游戏，原名 Moksha Patam。
一趟有上有下的小旅程
一颗骰子、几条可爱的蛇，一起向终点出发！
同一台设备
好友房间
玩家人数
真人
电脑
玩家 {n}
设置
语言
显示模式
跟随系统
浅色
深色
棋盘
经典版 · 100 格
小小步 · 50 格
点数刚好才能到终点（超过就往回走）
掷出六点可以再掷一次
玩法
从棋盘外出发，轮流掷骰子，沿数字前进。遇到梯子往上爬，遇到蛇头往下滑，最先到最后一格就获胜！
开启精确到达时，超过终点的步数要往回走。
关闭精确到达时，点数足以到达或超过终点就获胜。
开启追加回合时，掷出六点可以再掷一次。
开始玩
新游戏
继续游戏
回到首页
再玩一次
掷骰子
移动中…
轮到{player}
{player}获胜！
{player}掷出 {roll} 点：{from} → {to}。
爬梯子：{from} → {to}！
蛇蛇滑梯：{from} → {to}！
往回走！
六点！再掷一次。
第 {n} 格
起点
终点 · {n}
掷骰次数：{n}
从 1 到 {n} 的数字棋盘，下方列出各玩家的棋子位置。
← 游戏
房间代码
创建房间
加入房间
等待好友
分享代码，满员就会开始；房主也可以在至少两人加入后开始。
以当前人数开始
已有 {n} 人加入
你是{player}
复制代码
已复制代码
好友各用一台设备。创建房间须登录 AppAI，加入无需登录。
房间采用信任制：各玩家的设备自行掷骰子。
请登录 appai.info 以创建房间，并先在 appai.info 打开本游戏。
登录 AppAI
暂时无法连接房间，请重试。
请输入有效的六位房间代码。
找不到这个房间，请创建或加入其他房间。
这个房间已满。
请先等至少两位玩家加入。
回合已变更，棋盘已更新。
房间已更新，请查看棋盘，若轮到你就再掷一次。
无法验证房间的步骤，请回首页创建新房间。
错过太多回合，无法验证本局游戏，请创建新房间。
请稍等片刻再试。
这个房间的游戏已结束，请创建新房间再玩。
这个房间已经开始。
只有房主可以开始游戏。
无法完成这个操作，请重试。
无法保存，请保持网页打开以保留进度。
浏览器无法安全掷骰子，请换用较新的浏览器。
放大棋盘
棋盘适合屏幕
棋盘上的路线
等待中
已就绪
跳过离线玩家
这位玩家已离开两分钟，你可以跳过他的回合。
等待中的房间会在最后一人加入后两分钟关闭。
最先到第 {n} 格获胜
梯子 {from} → {to}
蛇 {from} → {to}
电脑思考中…
继续房间
暂停／首页`,
ja: `へびと梯子（すごろく）
インド生まれの伝統的な競走遊び。もとの名前はモークシャ・パタムです。
のぼったり、すべったり、小さな冒険
サイコロひとつと、かわいいへびたち。ゴールまで競争しよう！
この端末で遊ぶ
友だちとルームで遊ぶ
人数
人
コンピューター
プレイヤー {n}
設定
言語
画面の色
端末に合わせる
明るい
暗い
盤面
いつもの盤 · 100マス
ちいさな盤 · 50マス
ぴったりでゴール（余った分は戻る）
6が出たらもう一度
遊び方
盤の外から出発し、順番にサイコロを振って数字の順に進みます。梯子はのぼり、へびの頭からはすべりおります。最初に最後のマスに着いた人の勝ち！
ぴったりゴールがオンのとき、ゴールをこえた分だけ戻ります。
ぴったりゴールがオフのとき、ゴールに届くかこえる目で勝ちです。
もう一度の設定がオンのとき、6が出ると続けて振れます。
遊ぼう
新しいゲーム
続きを遊ぶ
ホームへ
もう一度遊ぶ
サイコロを振る
移動中…
{player}の番
{player}の勝ち！
{player}の目は{roll}：{from} → {to}。
梯子をのぼろう：{from} → {to}！
へびをすべろう：{from} → {to}！
余った分だけ戻ろう！
6！もう一度振ろう。
{n}マス目
スタート
ゴール · {n}
振った回数：{n}
1から{n}までの数字の盤。下に各コマの位置があります。
← ゲーム
ルームコード
ルームを作る
ルームに入る
友だちを待っています
コードを伝えよう。満員になると開始します。主催者は2人以上で始めることもできます。
今いる人で始める
{n}人が参加
あなたは{player}
コードをコピー
コピーしました
友だちはそれぞれの端末で遊びます。作成にはAppAIへのログインが必要ですが、参加には不要です。
ルームは信頼にもとづく遊びです。サイコロは各プレイヤーの端末で振ります。
作成するにはappai.infoにログインしてください。先にappai.infoでこのゲームを開いてください。
AppAIにログイン
ルームに接続できません。もう一度お試しください。
正しい6文字のコードを入力してください。
ルームが見つかりません。別のルームを作るか参加してください。
このルームは満員です。
先に2人以上が参加してください。
順番が変わりました。盤面を更新しました。
ルームが更新されました。盤面を確認し、自分の番ならもう一度振ってください。
ルームの手順を確認できません。ホームに戻り、新しいルームを作ってください。
確認できないほど多くの番を見逃しました。新しいルームを作ってください。
少し待ってからお試しください。
このルームは終了しました。もう一度遊ぶには新しく作ってください。
このルームはすでに始まっています。
主催者だけが開始できます。
操作できませんでした。もう一度お試しください。
保存できません。続けるにはこのページを開いたままにしてください。
このブラウザーでは安全にサイコロを振れません。新しいブラウザーをお試しください。
盤面を拡大
画面に合わせる
盤の道案内
待っています
準備できました
不在の人の番を飛ばす
この人は2分間不在です。番を飛ばせます。
待機中のルームは最後の参加から2分で閉じます。
最初に{n}に着いた人の勝ち
梯子 {from} → {to}
へび {from} → {to}
コンピューターが考えています…
ルームを再開
一時停止／ホーム`,
ko: `뱀과 사다리
인도에서 시작된 전통 경주 놀이로, 원래 이름은 목샤 파탐이에요.
올라가고 내려가는 작은 여행
주사위 하나와 귀여운 뱀들. 결승점까지 달려 봐요!
이 기기에서 놀기
친구와 방에서 놀기
참가 인원
사람
컴퓨터
참가자 {n}
설정
언어
화면 모드
기기 설정 따르기
밝게
어둡게
게임판
기본 · 100칸
작은 발걸음 · 50칸
정확한 수로 도착하기 (넘으면 뒤로)
6이 나오면 한 번 더
놀이 방법
게임판 밖에서 출발해 차례로 주사위를 굴리고 숫자를 따라가요. 사다리는 올라가고 뱀 머리에서는 내려가요. 마지막 칸에 먼저 도착하면 승리!
정확히 도착하기를 켜면 마지막 칸을 넘는 만큼 뒤로 돌아가요.
정확히 도착하기를 끄면 마지막 칸에 닿거나 넘는 수로 이겨요.
한 번 더 설정을 켜면 6이 나왔을 때 다시 굴려요.
시작해요
새 게임
이어 하기
처음으로
다시 놀기
주사위 굴리기
이동 중…
{player} 차례
{player} 승리!
{player}의 주사위는 {roll}: {from} → {to}.
사다리를 올라가요: {from} → {to}!
뱀을 타고 내려가요: {from} → {to}!
뒤로 돌아가요!
6이에요! 한 번 더 굴려요.
{n}번 칸
출발
도착 · {n}
굴린 횟수: {n}
1부터 {n}까지 숫자가 있는 게임판. 아래에 말의 위치가 나와요.
← 게임
방 코드
방 만들기
방 참가
친구를 기다려요
코드를 알려 주세요. 방이 가득 차면 시작해요. 방장은 두 명 이상 모이면 시작할 수 있어요.
현재 인원으로 시작
{n}명 참가
나는 {player}
코드 복사
복사했어요
친구들은 각자의 기기로 놀아요. 방을 만들려면 AppAI 로그인이 필요하지만 참가에는 필요 없어요.
방에서는 서로를 믿고 놀아요. 각 기기에서 자신의 주사위를 굴려요.
방을 만들려면 appai.info에 로그인하세요. 먼저 appai.info에서 이 게임을 열어 주세요.
AppAI 로그인
방에 연결할 수 없어요. 다시 시도해 주세요.
올바른 여섯 자리 코드를 입력해 주세요.
방을 찾을 수 없어요. 다른 방을 만들거나 참가해 주세요.
방이 가득 찼어요.
먼저 두 명 이상 참가해야 해요.
차례가 바뀌었어요. 게임판을 새로 불러왔어요.
방이 바뀌었어요. 게임판을 확인하고 내 차례라면 다시 굴려 주세요.
방의 이동을 확인할 수 없어요. 처음으로 돌아가 새 방을 만들어 주세요.
너무 많은 차례를 놓쳐 확인할 수 없어요. 새 방을 만들어 주세요.
잠시 기다린 뒤 다시 시도해 주세요.
이 방의 게임은 끝났어요. 새 방을 만들어 다시 놀아요.
이미 시작한 방이에요.
방장만 시작할 수 있어요.
실행할 수 없어요. 다시 시도해 주세요.
저장할 수 없어요. 게임을 유지하려면 이 페이지를 열어 두세요.
이 브라우저는 안전하게 주사위를 굴릴 수 없어요. 최신 브라우저를 써 주세요.
게임판 확대
화면에 맞추기
게임판 길 안내
기다리는 중
준비 완료
자리 비운 참가자 건너뛰기
이 참가자가 두 분 동안 자리를 비웠어요. 차례를 건너뛸 수 있어요.
대기 중인 방은 마지막 참가 후 두 분이 지나면 닫혀요.
{n}에 먼저 도착하면 승리
사다리 {from} → {to}
뱀 {from} → {to}
컴퓨터가 생각 중이에요…
방 이어 하기
일시 정지 / 처음으로`,
de: `Leiterspiel (Schlangen und Leitern)
Ein traditionelles Laufspiel aus Indien, ursprünglich Moksha Patam genannt.
Eine kleine Reise auf und ab
Ein Würfel, ein paar freundliche Schlangen und ein Rennen zum Ziel!
Auf diesem Gerät
Raum mit Freunden
Spieleranzahl
Mensch
Computer
Spieler {n}
Einstellungen
Sprache
Darstellung
Automatisch
Hell
Dunkel
Spielbrett
Klassisch · 100 Felder
Kleine Schritte · 50 Felder
Genau ins Ziel (überschüssige Schritte zurück)
Bei einer Sechs noch einmal würfeln
So wird gespielt
Startet neben dem Brett. Würfelt abwechselnd und folgt den Zahlen. Klettert Leitern hinauf und rutscht Schlangen hinunter. Wer zuerst das letzte Feld erreicht, gewinnt!
Bei genauem Zieleinlauf geht ihr die überschüssigen Schritte vom Ziel zurück.
Ohne genauen Zieleinlauf gewinnt ein Wurf, der das Ziel erreicht oder überschreitet.
Mit Zusatzwürfen dürft ihr nach einer Sechs noch einmal würfeln.
Los geht’s
Neues Spiel
Spiel fortsetzen
Zur Startseite
Noch einmal spielen
Würfeln
Unterwegs…
{player} ist dran
{player} gewinnt!
{player} würfelt {roll}: {from} → {to}.
Die Leiter hinauf: {from} → {to}!
Die Schlange hinunter: {from} → {to}!
Zurückspringen!
Sechs! Noch einmal würfeln.
Feld {n}
Start
Ziel · {n}
Würfe: {n}
Spielbrett mit Zahlen von 1 bis {n}. Die Figuren stehen darunter aufgelistet.
← Spiele
Raumcode
Raum erstellen
Raum beitreten
Auf Freunde warten
Teilt den Code. Ein voller Raum startet automatisch. Der Gastgeber kann auch mit mindestens zwei Spielern starten.
Mit diesen Spielern starten
{n} beigetreten
Du bist {player}
Code kopieren
Code kopiert
Alle spielen auf ihrem eigenen Gerät. Nur zum Erstellen eines Raums ist eine AppAI-Anmeldung nötig.
Raumwürfe beruhen auf Vertrauen: Jedes Gerät würfelt selbst.
Melde dich auf appai.info an, um einen Raum zu erstellen. Öffne dieses Spiel zuerst auf appai.info.
Bei AppAI anmelden
Die Raumverbindung ist nicht verfügbar. Versuche es erneut.
Gib einen gültigen Code mit sechs Zeichen ein.
Dieser Raum wurde nicht gefunden. Erstelle einen anderen oder tritt einem bei.
Dieser Raum ist voll.
Zuerst müssen mindestens zwei Spieler beitreten.
Der Zug hat gewechselt. Das Brett wurde aktualisiert.
Der Raum hat sich geändert. Prüfe das Brett und würfle erneut, wenn du dran bist.
Die Spielzüge konnten nicht geprüft werden. Gehe zur Startseite und erstelle einen neuen Raum.
Zu viele Züge wurden verpasst, um das Spiel zu prüfen. Bitte erstelle einen neuen Raum.
Warte bitte einen Moment und versuche es dann erneut.
Dieser Raum ist fertig. Erstelle einen neuen, um erneut zu spielen.
Dieser Raum hat bereits begonnen.
Nur der Gastgeber kann den Raum starten.
Die Aktion konnte nicht ausgeführt werden. Versuche es erneut.
Speichern ist nicht möglich. Lass diese Seite offen, um dein Spiel zu behalten.
Dein Browser kann nicht sicher würfeln. Probiere einen neueren Browser.
Brett vergrößern
Brett einpassen
Wege auf dem Brett
Warten
Bereit
Abwesenden Spieler überspringen
Dieser Spieler ist seit zwei Minuten weg. Du darfst seinen Zug überspringen.
Wartende Räume schließen zwei Minuten nach dem letzten Beitritt.
Wer zuerst {n} erreicht, gewinnt
Leiter {from} → {to}
Schlange {from} → {to}
Der Computer überlegt…
Raum fortsetzen
Pause / Startseite`,
fr: `Serpents et échelles
Un jeu de parcours traditionnel venu d’Inde, appelé à l’origine Moksha Patam.
Un petit voyage de hauts et de bas
Un dé, quelques gentils serpents et une course jusqu’à l’arrivée !
Sur cet appareil
Salon entre amis
Joueurs
Humain
Ordinateur
Joueur {n}
Réglages
Langue
Affichage
Automatique
Clair
Sombre
Plateau
Classique · 100 cases
Petits pas · 50 cases
Arrivée exacte (reculer si on dépasse)
Un six permet de rejouer
Comment jouer
Partez hors du plateau. Lancez le dé à tour de rôle et suivez les nombres. Montez les échelles et glissez sur les serpents. Le premier à la dernière case gagne !
Avec l’arrivée exacte, les pas qui dépassent la dernière case se font en arrière.
Sans arrivée exacte, un lancer qui atteint ou dépasse la dernière case fait gagner.
Si vous activez les tours supplémentaires, un six permet de relancer le dé.
À nous de jouer
Nouvelle partie
Reprendre la partie
Retour à l’accueil
Rejouer
Lancer le dé
En mouvement…
Au tour de {player}
{player} gagne !
{player} a fait {roll} : {from} → {to}.
On monte l’échelle : {from} → {to} !
On descend le serpent : {from} → {to} !
On repart en arrière !
Six ! Rejoue.
Case {n}
Départ
Arrivée · {n}
Lancers : {n}
Plateau numéroté de 1 à {n}. Les pions sont indiqués en dessous.
← Jeux
Code du salon
Créer un salon
Rejoindre un salon
En attendant les amis
Partage le code. Le salon démarre quand il est plein, ou l’hôte peut commencer avec au moins deux joueurs.
Commencer avec ces joueurs
{n} personnes présentes
Tu es {player}
Copier le code
Code copié
Chaque ami joue sur son appareil. Il faut se connecter à AppAI pour créer un salon, mais pas pour le rejoindre.
Les lancers reposent sur la confiance : chaque appareil lance son propre dé.
Connecte-toi à appai.info pour créer un salon. Ouvre d’abord ce jeu sur appai.info.
Se connecter à AppAI
La connexion au salon est indisponible. Réessaie.
Saisis un code valide de six caractères.
Ce salon est introuvable. Crée un autre salon ou rejoins-en un autre.
Ce salon est plein.
Au moins deux joueurs doivent d’abord rejoindre le salon.
Le tour a changé. Le plateau a été actualisé.
Le salon a changé. Vérifie le plateau et relance si c’est ton tour.
Impossible de vérifier les coups. Reviens à l’accueil et crée un autre salon.
Trop de tours ont été manqués pour vérifier cette partie. Crée un autre salon.
Attends un instant avant de réessayer.
La partie de ce salon est terminée. Crée un nouveau salon pour rejouer.
Ce salon a déjà commencé.
Seul l’hôte peut démarrer le salon.
Impossible d’effectuer cette action. Réessaie.
L’enregistrement est indisponible. Garde cette page ouverte pour conserver la partie.
Ton navigateur ne peut pas lancer le dé de façon sûre. Essaie un navigateur plus récent.
Agrandir le plateau
Adapter le plateau
Chemins du plateau
En attente
Prêt
Passer le joueur absent
Ce joueur est absent depuis deux minutes. Tu peux passer son tour.
Les salons en attente ferment deux minutes après la dernière arrivée.
Le premier à {n} gagne
Échelle {from} → {to}
Serpent {from} → {to}
L’ordinateur réfléchit…
Reprendre le salon
Pause / accueil`,
hi: `साँप सीढ़ी
भारत का पारंपरिक दौड़ वाला खेल, जिसका मूल नाम मोक्ष पटम था।
ऊपर-नीचे का एक छोटा सा सफ़र
एक पासा, कुछ प्यारे साँप और मंज़िल तक की दौड़!
इसी डिवाइस पर
दोस्तों के साथ कमरा
खिलाड़ियों की संख्या
इंसान
कंप्यूटर
खिलाड़ी {n}
सेटिंग
भाषा
रंग-रूप
डिवाइस के अनुसार
हल्का
गहरा
बिसात
पारंपरिक · 100 खाने
नन्हे कदम · 50 खाने
ठीक गिनती पर जीत (ज़्यादा होने पर पीछे लौटें)
छह आने पर फिर से पासा फेंकें
कैसे खेलें
बिसात के बाहर से शुरू करें। बारी-बारी पासा फेंकें और अंकों के अनुसार आगे बढ़ें। सीढ़ी पर चढ़ें और साँप के सिर से नीचे फिसलें। आख़िरी खाने पर पहले पहुँचने वाला जीतेगा!
ठीक गिनती वाला नियम चालू हो, तो आख़िरी खाने से आगे के कदम पीछे चलने होंगे।
यह नियम बंद हो, तो आख़िरी खाने तक पहुँचाने या उससे आगे ले जाने वाला अंक जीत दिलाता है।
दोबारा बारी का नियम चालू हो, तो छह आने पर फिर से पासा फेंकें।
चलो खेलें
नया खेल
खेल जारी रखें
मुख्य पन्ने पर
फिर से खेलें
पासा फेंकें
चल रहे हैं…
{player} की बारी
{player} जीत गए!
{player} को {roll} मिला: {from} → {to}।
सीढ़ी पर चढ़ें: {from} → {to}!
साँप से फिसलें: {from} → {to}!
पीछे लौटें!
छह! फिर से पासा फेंकें।
खाना {n}
शुरुआत
मंज़िल · {n}
पासा फेंका: {n} बार
1 से {n} तक अंकों वाली बिसात। गोटियों की जगह नीचे दी गई है।
← खेल
कमरे का कोड
कमरा बनाएँ
कमरे में जुड़ें
दोस्तों का इंतज़ार
कोड साझा करें। पूरा भरने पर कमरा शुरू होगा, या मेज़बान कम से कम दो खिलाड़ियों के साथ शुरू कर सकते हैं।
इन खिलाड़ियों के साथ शुरू करें
{n} खिलाड़ी जुड़े
आप {player} हैं
कोड कॉपी करें
कोड कॉपी हो गया
हर दोस्त अपने डिवाइस पर खेलता है। कमरा बनाने के लिए AppAI में साइन इन करना होगा, जुड़ने के लिए नहीं।
कमरे में भरोसे से खेलते हैं: हर खिलाड़ी का डिवाइस अपना पासा फेंकता है।
कमरा बनाने के लिए appai.info में साइन इन करें। पहले यह खेल appai.info पर खोलें।
AppAI में साइन इन करें
कमरे से जुड़ नहीं पा रहे हैं। फिर कोशिश करें।
छह अक्षरों वाला सही कोड लिखें।
यह कमरा नहीं मिला। दूसरा कमरा बनाएँ या किसी और कमरे में जुड़ें।
यह कमरा भर गया है।
पहले कम से कम दो खिलाड़ी जुड़ें।
बारी बदल गई है। बिसात ताज़ा कर दी गई है।
कमरा बदल गया है। बिसात देखें और अपनी बारी हो तो फिर पासा फेंकें।
कमरे की चालें जाँची नहीं जा सकीं। मुख्य पन्ने पर लौटकर नया कमरा बनाएँ।
इतनी बारियाँ छूट गईं कि खेल जाँचा नहीं जा सकता। नया कमरा बनाएँ।
फिर कोशिश करने से पहले थोड़ा रुकें।
इस कमरे का खेल ख़त्म हो गया। फिर खेलने के लिए नया कमरा बनाएँ।
यह कमरा पहले ही शुरू हो चुका है।
केवल मेज़बान कमरा शुरू कर सकते हैं।
यह काम नहीं हो सका। फिर कोशिश करें।
खेल सहेज नहीं पा रहे हैं। खेल बनाए रखने के लिए पन्ना खुला रखें।
आपका ब्राउज़र सुरक्षित ढंग से पासा नहीं फेंक सकता। नया ब्राउज़र आज़माएँ।
बिसात बड़ी करें
बिसात स्क्रीन में समाएँ
बिसात के रास्ते
इंतज़ार
तैयार
ग़ैरहाज़िर खिलाड़ी की बारी छोड़ें
यह खिलाड़ी दो मिनट से ग़ैरहाज़िर है। आप उनकी बारी छोड़ सकते हैं।
इंतज़ार वाले कमरे आख़िरी खिलाड़ी के जुड़ने के दो मिनट बाद बंद होते हैं।
{n} पर पहले पहुँचने वाला जीतेगा
सीढ़ी {from} → {to}
साँप {from} → {to}
कंप्यूटर सोच रहा है…
कमरा जारी रखें
रोकें / मुख्य पन्ना`,
};
export const messages = Object.fromEntries(Object.entries(phrases).map(([locale, list]) => {
  const values = list.split('\n');
  if (values.length !== keys.length) throw Error(`Translation length: ${locale} ${values.length}/${keys.length}`);
  return [locale, Object.fromEntries(keys.map((key, i) => [key, values[i]]))];
}));
export function matchLanguage(value) {
  const tag = String(value ?? '').toLowerCase().replaceAll('_', '-');
  const exact = Object.keys(languages).find(k => k.toLowerCase() === tag);
  if (exact) return exact;
  if (tag.split('-')[0] === 'zh') return /(?:^|-)hant(?:-|$)|(?:^|-)(?:tw|hk|mo)(?:-|$)/.test(tag) ? 'zh-TW' : 'zh-CN';
  return Object.keys(languages).find(k => k === tag.split('-')[0]) ?? null;
}
export function chooseLanguage(query, preferred = []) {
  const specified = matchLanguage(query);
  if (specified) return specified;
  for (const tag of preferred) { const found = matchLanguage(tag); if (found) return found; }
  return 'en';
}
export function translate(locale, key, args = {}) {
  const value = messages[locale]?.[key];
  if (value === undefined) throw Error(`Missing translation: ${locale}/${key}`);
  return value.replace(/\{(\w+)\}/g, (_, name) => String(args[name] ?? `{${name}}`));
}
