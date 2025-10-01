const wss = new WebSocket("wss://stream.bybit.com/v5/public/linear");

wss.addEventListener("open", function (event) {
    document.write("Bybit Wss")
    wss.send('{ "op": "subscribe", "args": ["publicTrade.XAUUSD"] }')
});

wss.addEventListener("close", function (event) {
    document.writeln("closed")

})

wss.addEventListener("message", function (event) {
    document.write("Data from bybit: " + event.data + "<br>")
})