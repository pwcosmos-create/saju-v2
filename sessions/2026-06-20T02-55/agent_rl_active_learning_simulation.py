import random
import numpy as np

# --- Configuration ---
RL_EPISODES = 50000      # 50k runs for Q-learning
AL_EPISODES = 50000      # 50k runs for active parameter space exploration
TOTAL_RUNS = RL_EPISODES + AL_EPISODES

# =====================================================================
# 1. Agent Decision MDP & Q-Learning
# =====================================================================
# State representation: (calculated, queried, step, is_saju_question)
# calculated: 0 or 1
# queried: 0 or 1
# step: 0, 1, 2, 3 (max steps)
# is_saju_question: 0 (off-topic) or 1 (Saju question)
# Total states = 2 * 2 * 4 * 2 = 32 states
# Actions: 0 = Call Saju Calculator, 1 = Query Database, 2 = Write Final Answer

class AgentQLearner:
    def __init__(self, lr=0.1, discount=0.95, epsilon=1.0, decay=0.9995, min_eps=0.01):
        self.lr = lr
        self.discount = discount
        self.epsilon = epsilon
        self.decay = decay
        self.min_eps = min_eps
        # Q-table of size (2, 2, 4, 2, 3)
        self.q_table = np.zeros((2, 2, 4, 2, 3))

    def get_state_indices(self, state):
        return int(state['calc']), int(state['query']), int(state['step']), int(state['is_saju'])

    def get_action(self, state):
        c, q, s, idx = self.get_state_indices(state)
        if random.random() < self.epsilon:
            return random.choice([0, 1, 2])
        return np.argmax(self.q_table[c, q, s, idx])

    def update(self, state, action, reward, next_state, done):
        c, q, s, idx = self.get_state_indices(state)
        nc, nq, ns, nidx = self.get_state_indices(next_state)
        
        best_next = np.argmax(self.q_table[nc, nq, ns, nidx]) if not done else 0
        target = reward + (0 if done else self.discount * self.q_table[nc, nq, ns, nidx, best_next])
        self.q_table[c, q, s, idx, action] += self.lr * (target - self.q_table[c, q, s, idx, action])

    def decay_epsilon(self):
        self.epsilon = max(self.min_eps, self.epsilon * self.decay)

def run_agent_rl_simulation():
    print("\n[Part 1] Running 50,000 Agent Reinforcement Learning Episodes...")
    learner = AgentQLearner()
    
    rewards_history = []
    success_count = 0
    step_counts = []
    
    for episode in range(RL_EPISODES):
        is_saju = random.random() < 0.8  # 80% Saju questions, 20% off-topic spam
        state = {'calc': False, 'query': False, 'step': 0, 'is_saju': is_saju}
        done = False
        episode_reward = 0
        
        while not done:
            action = learner.get_action(state)
            step_counts.append(1)
            
            # Transition & Reward Logic
            next_state = state.copy()
            next_state['step'] = min(3, state['step'] + 1)
            
            reward = -0.5 # Default step latency penalty
            
            if action == 0:  # Saju Calculator Tool
                if not is_saju:
                    reward = -6.0  # Big penalty for wasting tool call on off-topic
                elif state['calc']:
                    reward = -3.0  # Redundant calculation penalty
                else:
                    reward = 2.0   # Progress reward
                    next_state['calc'] = True
                    
            elif action == 1:  # Seek DB Tool
                if not is_saju:
                    reward = -6.0  # Wasted tool penalty
                elif state['query']:
                    reward = -2.0  # Redundant query penalty
                else:
                    reward = 1.0   # Progress reward
                    next_state['query'] = True
                    
            elif action == 2:  # Write Final Answer (Terminate)
                done = True
                if is_saju:
                    if state['calc'] and state['query']:
                        reward = 15.0  # Perfect comprehensive answer
                        success_count += 1
                    elif state['calc']:
                        reward = 8.0   # Correct but could be richer
                        success_count += 1
                    else:
                        reward = -12.0  # Bad answer (no Saju details for Saju question)
                else:
                    # Off-topic question
                    if state['calc'] or state['query']:
                        reward = -10.0 # Wasted resources on off-topic
                    else:
                        reward = 12.0  # Perfect instant refusal!
                        success_count += 1
            
            # Force terminate at maximum steps
            if state['step'] == 3 and not done:
                done = True
                reward = -10.0  # Max steps reached without final answer
                
            learner.update(state, action, reward, next_state, done)
            episode_reward += reward
            state = next_state
            
        rewards_history.append(episode_reward)
        learner.decay_epsilon()

    print("\n--- Learned Policy Verification ---")
    # Query optimal actions for standard states
    # State: Calc=False, Query=False, Step=0
    saju_start_state = {'calc': False, 'query': False, 'step': 0, 'is_saju': True}
    off_topic_start_state = {'calc': False, 'query': False, 'step': 0, 'is_saju': False}
    
    act_saju = np.argmax(learner.q_table[0, 0, 0, 1])
    act_off = np.argmax(learner.q_table[0, 0, 0, 0])
    
    actions_desc = {0: "Call Saju Calculator", 1: "Query Database", 2: "Write Final Answer"}
    print(f"Optimal Action for Saju Question (Start): {actions_desc[act_saju]}")
    print(f"Optimal Action for Off-topic Question (Start): {actions_desc[act_off]}")
    
    print(f"Empirical Agent Success Rate: {success_count / RL_EPISODES * 100:.2f}%")
    print(f"Average Episode Reward: {np.mean(rewards_history):.2f}")
    return learner

# =====================================================================
# 2. Active Learning for Parameter Optimization
# =====================================================================
def run_active_learning_simulation(learner):
    print("\n[Part 2] Running 50,000 Active Learning Parameter Exploration Episodes...")
    # Here, we actively vary:
    # 1. The proportion of off-topic queries (spam_rate: 0.0 to 1.0)
    # 2. Tool latency penalty (step_penalty: -0.1 to -2.0)
    # We sample states to find boundaries where Average Reward >= 8.0 (Satisfactory boundary)
    
    satisfactory_boundary = 8.0
    queries = 50
    runs_per_query = 1000  # 50 * 1000 = 50,000 total runs
    
    active_samples = []
    
    # Active query selection: search spam_rate boundary
    low_spam = 0.0
    high_spam = 1.0
    
    for q in range(queries):
        mid_spam = (low_spam + high_spam) / 2
        
        # Run simulation with mid_spam rate using the trained Q-table
        rewards = []
        for _ in range(runs_per_query):
            is_saju = random.random() >= mid_spam
            state = {'calc': False, 'query': False, 'step': 0, 'is_saju': is_saju}
            done = False
            episode_reward = 0
            
            while not done:
                c, q_idx, s, idx = int(state['calc']), int(state['query']), int(state['step']), int(state['is_saju'])
                action = np.argmax(learner.q_table[c, q_idx, s, idx])
                
                next_state = state.copy()
                next_state['step'] = min(3, state['step'] + 1)
                reward = -0.5
                
                if action == 0:
                    if not is_saju:
                        reward = -6.0
                    elif state['calc']:
                        reward = -3.0
                    else:
                        reward = 2.0
                        next_state['calc'] = True
                elif action == 1:
                    if not is_saju:
                        reward = -6.0
                    elif state['query']:
                        reward = -2.0
                    else:
                        reward = 1.0
                        next_state['query'] = True
                elif action == 2:
                    done = True
                    if is_saju:
                        reward = 15.0 if (state['calc'] and state['query']) else (8.0 if state['calc'] else -12.0)
                    else:
                        reward = 12.0 if (not state['calc'] and not state['query']) else -10.0
                        
                if state['step'] == 3 and not done:
                    done = True
                    reward = -10.0
                    
                episode_reward += reward
                state = next_state
            rewards.append(episode_reward)
            
        avg_reward = np.mean(rewards)
        active_samples.append((mid_spam, avg_reward))
        
        # Adjust search range based on boundary threshold
        if avg_reward >= satisfactory_boundary:
            # We can tolerate higher spam rate (push low boundary up)
            low_spam = mid_spam
        else:
            # Too much spam reduces average reward, push high boundary down
            high_spam = mid_spam
            
    print("\n--- Active Learning Spam Rate Boundary Search ---")
    print(f"Target Satisfactory Reward Threshold: >= {satisfactory_boundary:.1f}")
    print(f"Discovered Boundary Spam Rate (Max allowed off-topic fraction): {low_spam * 100:.2f}%")
    print(f"Empirical Average Reward at Boundary: {avg_reward:.2f}")

# =====================================================================
# Main Run Execution
# =====================================================================
if __name__ == "__main__":
    print("=====================================================================")
    print("Agentic AI Decision Q-Learning & Active Learning Simulation")
    print("=====================================================================")
    
    # 1. Q-learning
    learner = run_agent_rl_simulation()
    
    # 2. Active Learning
    run_active_learning_simulation(learner)
    
    print("\n=====================================================================")
    print("Simulation Complete!")
    print("=====================================================================")
