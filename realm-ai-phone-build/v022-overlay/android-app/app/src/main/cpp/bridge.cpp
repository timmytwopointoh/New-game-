#include <jni.h>
#include <string>
#include <vector>
#include <cstring>
#include "node.h"

// JNI adapter for mobile Node.js. All strings and argv storage remain alive during node::Start.
extern "C" JNIEXPORT jint JNICALL
Java_com_veilforge_realmagent_BotService_startNodeWithArguments(JNIEnv* env, jobject, jobjectArray args) {
    jsize count = env->GetArrayLength(args);
    std::vector<std::string> storage;
    storage.reserve(static_cast<size_t>(count));
    for (jsize i=0;i<count;i++) {
        auto jstr = static_cast<jstring>(env->GetObjectArrayElement(args,i));
        const char* chars = env->GetStringUTFChars(jstr,nullptr);
        storage.emplace_back(chars ? chars : "");
        if (chars) env->ReleaseStringUTFChars(jstr,chars);
        env->DeleteLocalRef(jstr);
    }
    std::vector<char*> argv;
    argv.reserve(storage.size());
    for (auto &value: storage) argv.push_back(value.data());
    return node::Start(static_cast<int>(argv.size()), argv.data());
}
