import ActivityKit
import Foundation

struct VoiceRoomActivityAttributes: ActivityAttributes {
    let marketId: String
    let marketName: String
    let tokenSymbol: String

    struct ContentState: Codable, Hashable {
        let participantCount: Int
        let isMuted: Bool
        let speakerName: String?
    }
}
