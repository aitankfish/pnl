import ExpoModulesCore
import ActivityKit

public class LiveActivityModule: Module {
    private var currentActivityId: String?

    public func definition() -> ModuleDefinition {
        Name("LiveActivityModule")

        AsyncFunction("startVoiceRoomActivity") { (marketId: String, marketName: String, tokenSymbol: String) -> String in
            if #available(iOS 16.1, *) {
                return try await self.startActivity(marketId: marketId, marketName: marketName, tokenSymbol: tokenSymbol)
            } else {
                return ""
            }
        }

        AsyncFunction("updateVoiceRoomActivity") { (participantCount: Int, isMuted: Bool, speakerName: String?) in
            if #available(iOS 16.1, *) {
                try await self.updateActivity(participantCount: participantCount, isMuted: isMuted, speakerName: speakerName)
            }
        }

        AsyncFunction("endVoiceRoomActivity") {
            if #available(iOS 16.1, *) {
                await self.endActivity()
            }
        }
    }

    @available(iOS 16.1, *)
    private func startActivity(marketId: String, marketName: String, tokenSymbol: String) async throws -> String {
        // End any existing activity first
        await endActivity()

        let attributes = VoiceRoomActivityAttributes(
            marketId: marketId,
            marketName: marketName,
            tokenSymbol: tokenSymbol
        )

        let initialState = VoiceRoomActivityAttributes.ContentState(
            participantCount: 1,
            isMuted: true,
            speakerName: nil
        )

        do {
            let activity = try Activity<VoiceRoomActivityAttributes>.request(
                attributes: attributes,
                contentState: initialState,
                pushType: nil
            )
            currentActivityId = activity.id
            return activity.id
        } catch {
            throw error
        }
    }

    @available(iOS 16.1, *)
    private func updateActivity(participantCount: Int, isMuted: Bool, speakerName: String?) async throws {
        guard let activityId = currentActivityId else { return }

        let updatedState = VoiceRoomActivityAttributes.ContentState(
            participantCount: participantCount,
            isMuted: isMuted,
            speakerName: speakerName
        )

        for activity in Activity<VoiceRoomActivityAttributes>.activities {
            if activity.id == activityId {
                await activity.update(using: updatedState)
                return
            }
        }
    }

    @available(iOS 16.1, *)
    private func endActivity() async {
        guard let activityId = currentActivityId else { return }

        let finalState = VoiceRoomActivityAttributes.ContentState(
            participantCount: 0,
            isMuted: true,
            speakerName: nil
        )

        for activity in Activity<VoiceRoomActivityAttributes>.activities {
            if activity.id == activityId {
                await activity.end(using: finalState, dismissalPolicy: .immediate)
                break
            }
        }

        currentActivityId = nil
    }
}
