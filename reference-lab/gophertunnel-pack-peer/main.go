// Independent local Gophertunnel Bedrock resource-pack server/control client.
// Only binds to 127.0.0.1, never accesses Microsoft accounts, Realms or secrets.
package main

import (
  "context"
  "encoding/json"
  "flag"
  "fmt"
  "log"
  "net"
  "os"
  "path/filepath"
  "strings"
  "time"

  "github.com/sandertv/gophertunnel/minecraft"
  "github.com/sandertv/gophertunnel/minecraft/protocol/packet"
  "github.com/sandertv/gophertunnel/minecraft/resource"
)

func main(){
  mode:=flag.String("mode","server","server or control")
  addr:=flag.String("addr","127.0.0.1:19174","loopback-only address")
  packCount:=flag.Int("packs",1,"1 or 8 synthetic resource packs")
  flag.Parse()
  if !strings.HasPrefix(*addr,"127.0.0.1:"){log.Fatal("reference lab must use loopback")}
  switch *mode{
    case "control":control(*addr)
    case "server":server(*addr,*packCount)
    default:log.Fatalf("invalid mode: %s",*mode)
  }
}

func makePack(dir string,i int)(*resource.Pack,error){
  p:=filepath.Join(dir,fmt.Sprintf("pack-%d",i))
  if e:=os.MkdirAll(p,0700);e!=nil{return nil,e}
  h:=fmt.Sprintf("f0e1d2c3-a4b5-46c7-89ab-%012x",i+1)
  m:=fmt.Sprintf("aabbccdd-1234-4567-89ab-%012x",i+1)
  manifest:=map[string]any{
    "format_version":2,
    "header":map[string]any{"name":fmt.Sprintf("VEILFORGE Ref Pack %d",i),
      "description":"Loopback-only synthetic pack",
      "uuid":h,"version":[]int{1,0,0},"min_engine_version":[]int{1,21,0}},
    "modules":[]any{map[string]any{"type":"resources","uuid":m,"version":[]int{1,0,0}}},
  }
  b,e:=json.Marshal(manifest);if e!=nil{return nil,e}
  if e=os.WriteFile(filepath.Join(p,"manifest.json"),b,0600);e!=nil{return nil,e}
  if e=os.WriteFile(filepath.Join(p,"reference.txt"),[]byte(strings.Repeat("VEILFORGE pack data",4096)),0600);e!=nil{return nil,e}
  return resource.ReadPath(p)
}

func server(addr string,n int){
  if n!=1&&n!=8{log.Fatal("only 1 or 8 synthetic packs")}
  dir,e:=os.MkdirTemp("","vf-ref-pack-");if e!=nil{log.Fatal(e)};defer os.RemoveAll(dir)
  packs:=make([]*resource.Pack,0,n)
  for i:=0;i<n;i++{
    p,e:=makePack(dir,i);if e!=nil{log.Fatal(e)}
    packs=append(packs,p)
  }
  cfg:=minecraft.ListenConfig{
    AuthenticationDisabled:true,
    ResourcePacks:packs,TexturePacksRequired:true,
    StatusProvider:minecraft.NewStatusProvider("VEILFORGE Reference (local only)","Ref Lab"),
    PacketFunc:func(h packet.Header,_ []byte,src,dst net.Addr){
      switch h.PacketID{
        case packet.IDResourcePacksInfo:fmt.Println("VF_REF_SENT_PACK_INFO")
        case packet.IDResourcePackClientResponse:fmt.Println("VF_REF_RECEIVED_OR_SENT_RESPONSE")
        case packet.IDResourcePackDataInfo:fmt.Println("VF_REF_SENT_PACK_HEADER")
        case packet.IDResourcePackChunkRequest:fmt.Println("VF_REF_RECEIVED_CHUNK_REQUEST")
        case packet.IDResourcePackChunkData:fmt.Println("VF_REF_SENT_CHUNK")
        case packet.IDResourcePackStack:fmt.Println("VF_REF_SENT_STACK")
      }
      _,_=src,dst
    },
  }
  listener,e:=cfg.Listen("raknet",addr);if e!=nil{log.Fatal(e)}
  defer listener.Close()
  fmt.Printf("VF_REF_SERVER_READY: packs=%d protocol=2225 loopback=true\n",n)
  time.AfterFunc(100*time.Second,func(){_ =listener.Close()})
  for {
    c,e:=listener.Accept()
    if e!=nil{return}
    conn:=c.(*minecraft.Conn)
    go func(){
      defer conn.Close()
      if e:=conn.StartGame(minecraft.GameData{});e!=nil{
        log.Printf("VF_REF_SERVER_STARTGAME_ERROR: %s",e)
      }else{
        fmt.Println("VF_REF_SERVER_STARTGAME: true")
        time.Sleep(4*time.Second)
      }
    }()
  }
}

func control(addr string){
  ctx,cancel:=context.WithTimeout(context.Background(),55*time.Second)
  defer cancel()
  dialer:=minecraft.Dialer{}
  conn,e:=dialer.DialContext(ctx,"raknet",addr)
  if e!=nil{log.Fatalf("VF_REF_CONTROL_CONNECT_FAILED: %v",e)}
  defer conn.Close()
  if e:=conn.DoSpawn();e!=nil{log.Fatalf("VF_REF_CONTROL_SPAWN_FAILED: %v",e)}
  fmt.Println("VF_REF_CONTROL_SPAWNED: true")
}
